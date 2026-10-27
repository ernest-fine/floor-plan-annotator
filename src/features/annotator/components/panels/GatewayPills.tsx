import Button from "@/shared/ui/Button";
import { registeredGateways } from "../../domain/gateways";
import type { GatewayAnnotation } from "../../domain/types";

export default function GatewayPills({
  gateways,
  disabled,
  onAdd,
}: {
  gateways: GatewayAnnotation[];
  disabled: boolean;
  onAdd: (gatewayId: string) => void;
}) {
  const available = registeredGateways(gateways);
  if (!available.length) return null;
  return (
    <div
      className="gateway-pills"
      role="group"
      aria-label="Add gateway reading"
    >
      {available.map((gateway) => (
        <Button
          key={gateway.id}
          className="gateway-pill"
          aria-label={`Add reading for ${gateway.name}`}
          disabled={disabled}
          onClick={() => onAdd(gateway.id)}
        >
          {gateway.name}
        </Button>
      ))}
    </div>
  );
}
