import type { Plugin } from "vite";
export default function profilePlugin(): Plugin {
  return {
    name: "local-performance-probes",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/src/")) return;
      const count = (name: string) =>
        `globalThis.__annotatorProfile?.count('${name}');\n`;
      if (id.endsWith("/features/annotator/pages/AnnotatorPage.tsx"))
        code = code.replace(
          "export default function AnnotatorPage() {",
          "export default function AnnotatorPage() {\n" + count("appRenders"),
        );
      if (id.endsWith("/components/map/MapCanvas.tsx")) {
        code = code.replace(
          "  const viewport = useRef",
          "  " + count("mapRenders") + "const viewport = useRef",
        );
        code = code.replace(
          /(  const \{ x, y, points \} = useMemo\()/,
          "  " + count("shapeRenders") + "$1",
        );
        code = code.replace(
          "    function resize() {",
          "    function resize() {\n" + count("resizeCallbacks"),
        );
      }
      if (id.endsWith("/components/panels/AnnotationList.tsx")) {
        const start = code.indexOf("export function AnnotationList(");
        const body = code.indexOf("  return (", start);
        if (start >= 0 && body >= 0)
          code =
            code.slice(0, body) +
            "  " +
            count("listRenders") +
            code.slice(body);
      }
      return { code, map: null };
    },
  };
}
