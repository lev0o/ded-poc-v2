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

    // Apply dark theme to the spec
    const darkSpec = {
      ...cleanSpec,
      background: "#0d1117",
      config: {
        ...cleanSpec.config,
        background: "#0d1117",
        axis: {
          ...cleanSpec.config?.axis,
          domainColor: "#30363d",
          gridColor: "#21262d",
          tickColor: "#30363d",
          labelColor: "#e6edf3",
          titleColor: "#f0f6fc"
        },
        legend: {
          ...cleanSpec.config?.legend,
          labelColor: "#e6edf3",
          titleColor: "#f0f6fc"
        },
        title: {
          ...cleanSpec.config?.title,
          color: "#f0f6fc"
        }
      }
    };

    embed(el, darkSpec, { actions: false })
      .then((res) => { 
        result = res;
      })
      .catch((e) => {
        console.error("vega error", e);
      });

    return () => {
      try { result?.view.finalize(); } catch {}
      el.innerHTML = "";
    };
  }, [spec]);

  return <div ref={ref} className="bg-[#0d1117] inline-block" />;
}
