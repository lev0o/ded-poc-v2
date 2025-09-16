"use client";

import { useEffect, useRef } from "react";
import embed, { VisualizationSpec, Result } from "vega-embed";

type Props = { spec: VisualizationSpec };

export default function VegaChart({ spec }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let result: Result | undefined;

    // Ensure spec is a plain object by deep cloning it
    const cleanSpec = JSON.parse(JSON.stringify(spec));

    embed(el, cleanSpec, { actions: false })
      .then((res) => { result = res; })
      .catch((e) => console.error("vega error", e));

    return () => {
      try { result?.view.finalize(); } catch {}
      el.innerHTML = "";
    };
  }, [spec]);

  return <div ref={ref} />;
}
