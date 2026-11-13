const cron = require("node-cron");
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const LowStockAlert = require("../models/LowStockAlert");
const { releaseReservation } = require("./inventoryService");
const { sendLowStockAlert } = require("./mailer");

// Runs every 5 minutes — cancels unpaid Razorpay orders pending > 15 min
const startCronJobs = (io) => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000);
      const stale = await Order.find({
        status: "pending",
        "payment.method": "razorpay",
        "payment.status": "pending",
        createdAt: { $lt: cutoff },
      });

      for (const order of stale) {
        order.status = "cancelled";
        order.statusHistory.push({ status: "cancelled", note: "Auto-cancelled: payment timeout" });
        await order.save();

        // Release stock reservation so other orders can use the stock
        if (order.stockReserved && !order.stockDeducted) {
          releaseReservation(order.items, order._id, null, "payment_failure").catch(console.error);
        }

        io.to(`order_${order._id}`).emit("order_status_update", {
          orderId: order._id,
          status: "cancelled",
          updatedAt: new Date(),
        });
      }

      if (stale.length) console.log(`Cron: auto-cancelled ${stale.length} stale order(s)`);
    } catch (err) {
      console.error("Cron error:", err.message);
    }
  });

  // Runs every 10 minutes — clears paymentProcessing locks stuck > 5 min
  // (guards against server crash mid-payment leaving an order permanently locked)
  cron.schedule("*/10 * * * *", async () => {
    try {
      const lockCutoff = new Date(Date.now() - 5 * 60 * 1000);
      const result = await Order.updateMany(
        {
          paymentProcessing: true,
          paymentProcessingAt: { $lt: lockCutoff },
        },
        {
          $set: { paymentProcessing: false, paymentProcessingAt: null },
        }
      );
      if (result.modifiedCount > 0) {
        console.log(`Cron: released ${result.modifiedCount} stale paymentProcessing lock(s)`);
      }
    } catch (err) {
      console.error("Cron lock-release error:", err.message);
    }
  });

  // ── Low-stock inventory check ──────────────────────────────────────────────
  // Schedule: LOW_STOCK_CRON env var (default: every 5 minutes).
  // Dedup: a LowStockAlert document is inserted atomically per item.
  // Only the instance that wins the upsert sends the email.
  // Alert resets when stock is restocked above threshold (see clearLowStockAlert).
  const lowStockSchedule = process.env.LOW_STOCK_CRON || "*/5 * * * *";

  cron.schedule(lowStockSchedule, async () => {
    try {
      // Only check items with finite, tracked stock
      const lowItems = await Inventory.find({
        stock: { $gte: 0 },
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      }).lean();

      if (!lowItems.length) return;

      const toAlert = [];

      for (const item of lowItems) {
        try {
          // Atomic insert — throws duplicate-key (E11000) if alert already exists
          await LowStockAlert.create({
            item:         item._id,
            stockAtAlert: item.stock,
          });
          toAlert.push(item); // won the race — this instance sends the email
        } catch (err) {
          if (err.code !== 11000) console.error(`[low-stock] dedup error for "${item.name}":`, err.message);
          // E11000 = alert already active for this item — skip silently
        }
      }

      if (!toAlert.length) return;

      console.log(`[low-stock] Sending alert for ${toAlert.length} item(s): ${toAlert.map((i) => i.name).join(", ")}`);

      try {
        const info = await sendLowStockAlert(toAlert);
        if (info) {
          // Log accepted/rejected without exposing addresses in detail
          const accepted = info.accepted?.length ?? "?";
          const rejected = info.rejected?.length ?? 0;
          console.log(`[low-stock] Email accepted by SMTP (accepted=${accepted}, rejected=${rejected})`);
          if (rejected > 0) console.warn(`[low-stock] SMTP rejected ${rejected} recipient(s)`);
        }
      } catch (smtpErr) {
        // SMTP failure — roll back the alert records so the next run retries
        console.error("[low-stock] SMTP error:", smtpErr.message);
        await LowStockAlert.deleteMany({ item: { $in: toAlert.map((i) => i._id) } });
      }
    } catch (err) {
      console.error("[low-stock] Cron error:", err.message);
    }
  });

  console.log(`Cron jobs started (low-stock schedule: ${lowStockSchedule})`);
};

/**
 * Call this whenever an inventory item is restocked above its threshold.
 * Removes the active alert record so the next dip triggers a fresh email.
 */
const clearLowStockAlert = async (itemId) => {
  try {
    await LowStockAlert.deleteOne({ item: itemId });
  } catch (err) {
    console.error("[low-stock] clearLowStockAlert error:", err.message);
  }
};

module.exports = { startCronJobs, clearLowStockAlert };
