const cron = require("node-cron");
const Order = require("../models/Order");
const { releaseReservation } = require("./inventoryService");

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

  console.log("Cron jobs started");
};

module.exports = { startCronJobs };
