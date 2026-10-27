import type { Annotation, GatewayAnnotation, Reading } from "./types";
export function registeredGateways(items: Annotation[]): GatewayAnnotation[] {
  return items.filter(
    (item): item is GatewayAnnotation =>
      item.type === "gateway" && !!item.name.trim(),
  );
}
export function createGatewayLookup(gateways: GatewayAnnotation[]) {
  const byId = new Map(gateways.map((gateway) => [gateway.id, gateway]));
  const byName = new Map<string, GatewayAnnotation | undefined>();
  for (const gateway of gateways) {
    const name = gateway.name.trim().toLowerCase();
    if (name) byName.set(name, byName.has(name) ? undefined : gateway);
  }
  return (reading: Reading): GatewayAnnotation | undefined =>
    reading.gatewayId !== undefined
      ? byId.get(reading.gatewayId)
      : byName.get(reading.gateway.trim().toLowerCase());
}
export function resolveReadingGateway(
  reading: Reading,
  gateways: GatewayAnnotation[],
): GatewayAnnotation | undefined {
  return createGatewayLookup(gateways)(reading);
}
export function requireGateway(
  id: string,
  gateways: GatewayAnnotation[],
): GatewayAnnotation {
  const gateway = gateways.find((gateway) => gateway.id === id);
  if (!gateway)
    throw new Error("Select a placed gateway before entering signal readings.");
  return gateway;
}
