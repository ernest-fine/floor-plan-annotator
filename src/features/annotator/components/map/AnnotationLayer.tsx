import {memo,useMemo} from "react";
import type {Annotation,MapImage,Position} from "../../domain/types";
import {geometry,measure,textLines,arrowHead} from "../../domain/annotationGeometry";
import {describe} from "../../domain/annotationLabels";
const AnnotationShape = memo(function AnnotationShape({
  item,
  image,
  scale,
  selected,
  draft,
}: {
  item: Annotation;
  image: MapImage;
  scale: number;
  selected: boolean;
  draft: boolean;
}) {
  // @profile:shape-renders
  const { x, y, points } = useMemo(() => geometry(item, image), [item, image]);
  const polyline = useMemo(
    () => points.map((point) => point.join(",")).join(" "),
    [points],
  );
  const m =
    item.type === "point"
      ? Math.max(
          measure(item, image.width),
          Math.max(12, (16 * item.size) / 2.8) * scale,
        )
      : measure(item, image.width);
  const common = {
    "data-id": item.id,
    role: "button" as const,
    tabIndex: draft ? -1 : 0,
    "aria-label": describe(item),
    "aria-pressed": selected,
  };
  if (item.type === "point")
    return (
      <g {...common}>
        <circle cx={x} cy={y} r={Math.max(22 * scale, m)} fill="transparent" />
        <circle
          className="focus-ring"
          cx={x}
          cy={y}
          r={m + 4 * scale}
          fill="none"
          stroke={selected ? "#127a50" : "transparent"}
          strokeWidth={2 * scale}
        />
        <circle
          cx={x}
          cy={y}
          r={m}
          fill={item.color}
          stroke="#fff"
          strokeWidth={Math.max(1.4 * scale, m * 0.13)}
        />
        <text
          x={x}
          y={y + m * 0.34}
          textAnchor="middle"
          fill="#fff"
          fontSize={m * (String(item.number).length > 2 ? 0.64 : 0.9)}
          fontFamily="system-ui,sans-serif"
          fontWeight="750"
          pointerEvents="none"
        >
          {item.number}
        </text>
      </g>
    );
  if (item.type === "text") {
    const lines = textLines(item.text);
    return (
      <g {...common}>
        <rect
          className="focus-ring"
          x={x - 4 * scale}
          y={y - 4 * scale}
          width={Math.max(
            44 * scale,
            m *
              Math.max(...lines.map((line) => Array.from(line).length), 1) *
              0.68 +
              8 * scale,
          )}
          height={Math.max(44 * scale, m * 1.3 * lines.length + 8 * scale)}
          fill="transparent"
          stroke={selected ? "#127a50" : "transparent"}
          strokeWidth={scale}
          strokeDasharray={`${4 * scale} ${3 * scale}`}
        />
        <text
          fill={item.color}
          fontSize={m}
          fontWeight="650"
          fontFamily="system-ui,sans-serif"
          stroke="#fff"
          strokeWidth={m * 0.16}
          strokeLinejoin="round"
          paintOrder="stroke"
          pointerEvents="none"
        >
          {lines.map((line, index) => (
            <tspan key={index} x={x} y={y + m * (1 + index * 1.3)}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }
  return (
    <g {...common}>
      <polyline
        points={polyline}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(44 * scale, m + 8 * scale)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {selected && (
        <polyline
          className="focus-ring"
          points={polyline}
          fill="none"
          stroke="#127a50"
          strokeWidth={m + 5 * scale}
          strokeOpacity=".25"
          strokeLinecap="round"
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={item.color}
        strokeWidth={m}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {item.type === "arrow" && (
        <polygon
          points={arrowHead(points, m)
            .map((point) => point.join(","))
            .join(" ")}
          fill={item.color}
        />
      )}
      {item.type === "pen" && points.length === 1 && (
        <circle
          cx={points[0][0]}
          cy={points[0][1]}
          r={m / 2}
          fill={item.color}
        />
      )}
    </g>
  );
});


export default function AnnotationLayer({items,preview,image,selectedId,width}:{items:Annotation[];preview:Annotation|null;image:MapImage;selectedId:string|null;width:number}){
  const visible=preview?[...items.filter(item=>item.id!==preview.id),preview]:items;
  return <>{visible.map(item=><AnnotationShape key={item.id} item={item} image={image} scale={image.width/width} selected={item.id===selectedId} draft={item.id===preview?.id&&!items.some(saved=>saved.id===item.id)}/>)}</>;
}
