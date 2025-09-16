"use client";

import { useEffect, useRef, useState } from "react";
import embed, { VisualizationSpec, Result } from "vega-embed";

type Props = { 
  spec: VisualizationSpec;
  className?: string;
};

export default function VegaChartWrapper({ spec, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !ref.current) return;
    
    const el = ref.current;
    let result: Result | undefined;

    // Create a completely clean spec object
    const cleanSpec = createCleanSpec(spec);

    embed(el, cleanSpec, { actions: false })
      .then((res) => { result = res; })
      .catch((e) => console.error("vega error", e));

    return () => {
      try { 
        result?.view.finalize(); 
      } catch (e) {
        // Ignore cleanup errors
      }
      el.innerHTML = "";
    };
  }, [spec, isClient]);

  // Don't render until we're on the client
  if (!isClient) {
    return <div className={className} ref={ref} />;
  }

  return <div className={className} ref={ref} />;
}

// Helper function to create a completely clean spec
function createCleanSpec(spec: VisualizationSpec): VisualizationSpec {
  // Deep clone and ensure all values are serializable
  const cloned = JSON.parse(JSON.stringify(spec));
  
  // Additional cleanup for any potential Set objects or other non-serializable data
  return cleanObject(cloned);
}

// Recursively clean an object to remove any non-serializable data
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'function') {
    return undefined; // Remove functions
  }
  
  if (obj instanceof Set || obj instanceof Map || obj instanceof Date) {
    return undefined; // Remove non-serializable objects
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanObject(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  return obj;
}
