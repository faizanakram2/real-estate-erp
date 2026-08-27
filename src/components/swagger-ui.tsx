"use client";

import SwaggerUI from "swagger-ui-react";
// swagger-ui-react does not provide TypeScript declarations for its CSS entry.
// @ts-expect-error: CSS is handled by the bundler at runtime.
import "swagger-ui-react/swagger-ui.css";

export default function SwaggerPage() {
  return (
    <div className="swagger-container">
      <SwaggerUI url="/api/swagger" />
    </div>
  );
}
