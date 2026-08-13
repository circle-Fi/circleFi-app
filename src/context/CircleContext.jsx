import React, { createContext, useState, useCallback } from 'react';
import { CircleFiSDK } from '@circlefi/sdk';

export const CircleContext = createContext();

export const CircleProvider = ({ children }) => {
  const [circles, setCircles] = useState([]);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize SDK (assumes user has wallet connected)
  const sdk = new CircleFiSDK({
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
  });

  const createCircle = useCallback(async (circleData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.createCircle({
        name: circleData.name,
        contribution_amount: circleData.contributionAmount,
        cycle_duration_days: circleData.cycleDurationDays,
        payout_order: circleData.payoutOrder,
        collateral_percentage: circleData.collateralPercentage,
        dispute_window_hours: circleData.disputeWindowHours,
      });
      
      // Add to local state
      setCircles(prev => [...prev, result]);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  const joinCircle = useCallback(async (circleId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.joinCircle(circleId);
      setSelectedCircle(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  const contribute = useCallback(async (circleId, amount) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.contribute(circleId, amount);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  const placeBid = useCallback(async (circleId, bidAmount) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.placeBid(circleId, bidAmount);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  const getCircles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.getCircles();
      setCircles(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  const value = {
    circles,
    selectedCircle,
    currentMember,
    loading,
    error,
    createCircle,
    joinCircle,
    contribute,
    placeBid,
    getCircles,
    setSelectedCircle,
  };

  return <CircleContext.Provider value={value}>{children}</CircleContext.Provider>;
};
