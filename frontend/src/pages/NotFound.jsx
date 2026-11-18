import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="error-page">
      <p className="error-code">404</p>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link to="/" className="btn-primary">Go Home</Link>
        <Link to="/menu" className="btn-outline">Browse Menu</Link>
      </div>
    </div>
  );
}
