"use client";

import React from "react";

export interface ActivityItem {
  id: string;
  text: React.ReactNode;
  time: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

interface ActivityListProps {
  items: ActivityItem[];
}

export default function ActivityList({ items }: ActivityListProps) {
  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className="dash-activity-item">
          <div
            className="dash-activity-icon"
            style={{ background: item.iconBg, color: item.iconColor }}
          >
            {item.icon}
          </div>
          <div className="dash-activity-content">
            <div className="dash-activity-text">{item.text}</div>
            <div className="dash-activity-time">{item.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
