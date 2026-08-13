import React, { useState, useEffect } from 'react';
import './CircleList.css';

export const CircleList = ({ circles, onSelectCircle }) => {
  const [loading, setLoading] = useState(false);

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="circle-list-container">
      <h2>Your Circles</h2>
      {circles.length === 0 ? (
        <p className="empty-state">No circles yet. Create one to get started!</p>
      ) : (
        <div className="circle-list">
          {circles.map((circle) => (
            <div key={circle.id} className="circle-card" onClick={() => onSelectCircle(circle)}>
              <div className="circle-header">
                <h3>{circle.name}</h3>
                <span className={`status ${circle.is_active ? 'active' : 'inactive'}`}>
                  {circle.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="circle-details">
                <p><strong>Contribution:</strong> ${circle.contribution_amount}</p>
                <p><strong>Cycle:</strong> {circle.cycle_duration_days} days</p>
                <p><strong>Members:</strong> {circle.members_count || 0}</p>
                <p><strong>Round:</strong> {circle.current_round}</p>
                <p><strong>Payout:</strong> {circle.payout_order === 'fixed' ? 'Fixed' : 'Bid-Based'}</p>
              </div>
              <button className="select-btn">View Details</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
