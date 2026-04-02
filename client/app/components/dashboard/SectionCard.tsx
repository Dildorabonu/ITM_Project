"use client";

import React from "react";

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

export default function SectionCard({ title, icon, action, children, noPadding }: SectionCardProps) {
  return (
    <div className="itm-card">
      <div className="itm-card-header">
        {icon && <div className="icon-bg ib-blue">{icon}</div>}
        <span className="itm-card-title">{title}</span>
        {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
      </div>
      {noPadding ? children : <div className="itm-card-body">{children}</div>}
    </div>
  );
}
