"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { VisualizationSpec, Result } from "vega-embed";

// Use require to avoid TypeScript issues
const vegaEmbed = require("vega-embed");

type Props = { spec: VisualizationSpec };

export interface VegaChartRef {
  downloadAsPNG: () => Promise<void>;
  downloadAsSVG: () => Promise<void>;
}

const VegaChart = forwardRef<VegaChartRef, Props>(({ spec }, ref) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<any>(null);

  // Expose download methods to parent component
  useImperativeHandle(ref, () => ({
    downloadAsPNG: async () => {
      if (!viewRef.current) {
        console.error('Vega view not available');
        return;
      }
      try {
        const url = await viewRef.current.toImageURL('png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `chart_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Error generating PNG:', error);
      }
    },
    downloadAsSVG: async () => {
      if (!viewRef.current) {
        console.error('Vega view not available');
        return;
      }
      try {
        const svgData = await viewRef.current.toSVG();
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `chart_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Error generating SVG:', error);
      }
    }
  }));

  useEffect(() => {
    if (!chartRef.current) return;
    const el = chartRef.current;
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

    vegaEmbed.embed(el, darkSpec, { actions: false })
      .then((res: Result) => { 
        result = res;
        viewRef.current = res.view; // Store the view reference
      })
      .catch((e: any) => {
        console.error("vega error", e);
      });

    return () => {
      try { result?.view.finalize(); } catch {}
      el.innerHTML = "";
      viewRef.current = null;
    };
  }, [spec]);

  return <div ref={chartRef} className="bg-[#0d1117] inline-block" />;
});

VegaChart.displayName = 'VegaChart';

export default VegaChart;