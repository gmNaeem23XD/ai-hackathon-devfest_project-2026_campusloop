"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import BrandMark from "@/components/BrandMark";
import { APP_NAME, ORGANIZATION_NAME, SPLASH_DURATION_MS, SPLASH_ENABLED } from "@/lib/config";

const SESSION_KEY = "campusloop-startup-seen";

export default function StartupSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!SPLASH_ENABLED) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Keep the intro available when browser storage is disabled.
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS + 100);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div className="startup-splash" style={{ "--splash-duration": `${SPLASH_DURATION_MS}ms` } as CSSProperties} role="status" aria-label={`${APP_NAME}, ${ORGANIZATION_NAME}`}>
      <div className="startup-lockup">
        <BrandMark size={31} className="startup-mark size-16 rounded-xl bg-white text-campus-800" />
        <p className="startup-name">{APP_NAME}</p>
        <p className="startup-organization">{ORGANIZATION_NAME}</p>
      </div>
      <span className="startup-progress" aria-hidden="true" />
    </div>
  );
}
