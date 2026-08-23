import logo from "../../assets/forward-insight-logo.png";

export function Brand({ hideText = false }: { hideText?: boolean }) {
  return <div className="brand">
    <img src={logo} alt="Forward Insight" />
    <span className={hideText ? "sr-only" : ""}>FORWARD<br />INSIGHT</span>
  </div>;
}
