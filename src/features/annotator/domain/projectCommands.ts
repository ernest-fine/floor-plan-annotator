import type {
  Annotation,
  AnnotationPatch,
  Project,
  ReadingUpdate,
  DotAnnotation,
  Reading,
} from "./types";
import {
  registeredGateways,
  requireGateway,
  resolveReadingGateway,
} from "./gateways";
import {
  blankReading,
  isSignalDraft,
  normalizeRssiMagnitude,
} from "./signalReadings";
export type ProjectCommand =
  | { type: "annotation.add"; annotation: Annotation }
  | { type: "annotation.move"; annotation: Annotation }
  | { type: "annotation.update"; id: string; patch: AnnotationPatch }
  | { type: "annotation.remove"; id: string }
  | { type: "annotations.clear" }
  | { type: "title.set"; title: string }
  | { type: "reading.add"; pointId: string; gatewayId: string }
  | {
      type: "reading.update";
      pointId: string;
      index: number;
      patch: ReadingUpdate;
    }
  | { type: "reading.remove"; pointId: string; index: number };
function updateReadings(
  project: Project,
  pointId: string,
  update: (point: DotAnnotation) => Reading[],
): Project {
  return {
    ...project,
    items: project.items.map((item) =>
      item.id === pointId && item.type === "point"
        ? { ...item, readings: update(item) }
        : item,
    ),
  };
}
function patchMetadata(
  annotation: Annotation,
  patch: AnnotationPatch,
): Annotation {
  const common = {
    color: patch.color ?? annotation.color,
    size: patch.size ?? annotation.size,
  };
  if (annotation.type === "point" || annotation.type === "gateway")
    return {
      ...annotation,
      ...common,
      name: patch.name ?? annotation.name,
      notes: patch.notes ?? annotation.notes,
    };
  if (annotation.type === "text")
    return { ...annotation, ...common, text: patch.text ?? annotation.text };
  return { ...annotation, ...common };
}
export function applyProjectCommand(
  project: Project,
  command: ProjectCommand,
): Project {
  switch (command.type) {
    case "title.set":
      return { ...project, title: command.title };
    case "annotation.add": {
      if (project.items.length >= 3000)
        throw new Error("Annotation limit: 3000.");
      if (project.items.some((item) => item.id === command.annotation.id))
        throw new Error("Annotation already exists.");
      const annotation = command.annotation;
      if (
        annotation.type === "gateway" &&
        annotation.name.trim() &&
        project.items.some(
          (item) =>
            item.type === "gateway" &&
            item.name.trim().toLowerCase() ===
              annotation.name.trim().toLowerCase(),
        )
      )
        throw new Error("Gateway names must be unique.");
      return {
        ...project,
        items: [...project.items, annotation],
        nextNumber:
          annotation.type === "point"
            ? project.nextNumber + 1
            : project.nextNumber,
      };
    }
    case "annotation.remove":
      return {
        ...project,
        items: project.items.filter((item) => item.id !== command.id),
      };
    case "annotations.clear":
      return { ...project, items: [], nextNumber: 1 };
    case "annotation.move":
      return {
        ...project,
        items: project.items.map((item) =>
          item.id === command.annotation.id ? command.annotation : item,
        ),
      };
    case "annotation.update": {
      const current = project.items.find((item) => item.id === command.id);
      if (current?.type === "gateway" && command.patch.name !== undefined) {
        const candidate = command.patch.name.trim().toLowerCase();
        if (
          candidate &&
          project.items.some(
            (item) =>
              item.type === "gateway" &&
              item.id !== current.id &&
              item.name.trim().toLowerCase() === candidate,
          )
        )
          throw new Error("Gateway names must be unique.");
      }
      return {
        ...project,
        items: project.items.map((item) =>
          item.id === command.id ? patchMetadata(item, command.patch) : item,
        ),
      };
    }
    case "reading.add": {
      const gateway = requireGateway(
        command.gatewayId,
        registeredGateways(project.items),
      );
      return updateReadings(project, command.pointId, (point) =>
        point.readings.length >= 300
          ? point.readings
          : [
              ...point.readings,
              {
                ...blankReading(),
                gatewayId: gateway.id,
                gateway: gateway.name.trim(),
              },
            ],
      );
    }
    case "reading.remove":
      return updateReadings(project, command.pointId, (point) =>
        point.readings.filter((_, index) => index !== command.index),
      );
    case "reading.update":
      return updateReadings(project, command.pointId, (point) =>
        point.readings.map((reading, index) => {
          if (index !== command.index) return reading;
          const gateways = registeredGateways(project.items);
          const gateway =
            command.patch.gatewayId !== undefined
              ? requireGateway(command.patch.gatewayId, gateways)
              : resolveReadingGateway(reading, gateways);
          if (!gateway)
            throw new Error(
              "Select a placed gateway before entering signal readings.",
            );
          const reassigned =
            command.patch.gatewayId !== undefined &&
            resolveReadingGateway(reading, gateways)?.id !== gateway.id;
          const next = {
            ...(reassigned ? blankReading() : reading),
            gatewayId: gateway.id,
            gateway: gateway.name.trim(),
          };
          if (command.patch.rssi !== undefined) {
            if (!isSignalDraft(command.patch.rssi))
              throw new Error("RSSI must be numeric.");
            const rssi = normalizeRssiMagnitude(command.patch.rssi);
            if (!isSignalDraft(rssi)) throw new Error("RSSI is too long.");
            next.rssi = rssi;
          }
          if (command.patch.snr !== undefined) {
            if (!isSignalDraft(command.patch.snr))
              throw new Error("SNR must be numeric.");
            next.snr = command.patch.snr;
          }
          return next;
        }),
      );
  }
}
