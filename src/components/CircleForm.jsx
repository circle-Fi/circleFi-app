import React, { useState, useContext } from 'react';
import './CircleForm.css';
import { CircleContext } from '../context/CircleContext';

export const CircleForm = () => {
  const { createCircle } = useContext(CircleContext);
  const [formData, setFormData] = useState({
    name: '',
    contributionAmount: '',
    cycleDurationDays: 30,
    payoutOrder: 'fixed',
    collateralPercentage: 20,
    disputeWindowHours: 24,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'contributionAmount' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createCircle(formData);
      setFormData({
        name: '',
        contributionAmount: '',
        cycleDurationDays: 30,
        payoutOrder: 'fixed',
        collateralPercentage: 20,
        disputeWindowHours: 24,
      });
    } catch (error) {
      console.error('Error creating circle:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="circle-form">
      <h2>Create a New Circle</h2>
      
      <div className="form-group">
        <label htmlFor="name">Circle Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="My Savings Circle"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="contributionAmount">Contribution Amount (USD)</label>
        <input
          type="number"
          id="contributionAmount"
          name="contributionAmount"
          value={formData.contributionAmount}
          onChange={handleChange}
          placeholder="100"
          required
          min="1"
        />
      </div>

      <div className="form-group">
        <label htmlFor="cycleDurationDays">Cycle Duration (Days)</label>
        <input
          type="number"
          id="cycleDurationDays"
          name="cycleDurationDays"
          value={formData.cycleDurationDays}
          onChange={handleChange}
          min="1"
        />
      </div>

      <div className="form-group">
        <label htmlFor="payoutOrder">Payout Order</label>
        <select
          id="payoutOrder"
          name="payoutOrder"
          value={formData.payoutOrder}
          onChange={handleChange}
        >
          <option value="fixed">Fixed Rotation</option>
          <option value="bid">Bid-Based</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="collateralPercentage">Collateral Requirement (%)</label>
        <input
          type="number"
          id="collateralPercentage"
          name="collateralPercentage"
          value={formData.collateralPercentage}
          onChange={handleChange}
          min="0"
          max="100"
        />
      </div>

      <div className="form-group">
        <label htmlFor="disputeWindowHours">Dispute Window (Hours)</label>
        <input
          type="number"
          id="disputeWindowHours"
          name="disputeWindowHours"
          value={formData.disputeWindowHours}
          onChange={handleChange}
          min="1"
        />
      </div>

      <button type="submit" className="submit-btn">Create Circle</button>
    </form>
  );
};
