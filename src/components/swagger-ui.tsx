"use client";

import SwaggerUI from "swagger-ui-react";

export default function SwaggerPage() {
  return (
    <div className="swagger-container">
      <SwaggerUI url="/api/swagger" />
    </div>
  );
}