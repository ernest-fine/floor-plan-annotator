import type { Plugin } from "vite";
export default function profilePlugin(): Plugin {
  return {
    name: "local-performance-probes",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/src/")) return;
      const count = (name: string) =>
        `globalThis.__annotatorProfile?.count('${name}');\n`;
      if (id.endsWith("/App.tsx"))
        code = code.replace(
          "export default function App() {",
          "export default function App() {\n" + count("appRenders"),
        );
      if (id.endsWith("/components/MapCanvas.tsx")) {
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
      if (id.endsWith("/components/Panels.tsx")) {
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
