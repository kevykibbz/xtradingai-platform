
import { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useDerivAPI } from '@/contexts/DerivContext';

export const useTensorFlowPrediction = (symbol) => {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState('rise');
  const [confidence, setConfidence] = useState(0.5);
  const [isTraining, setIsTraining] = useState(false);
  const { tickData } = useDerivAPI();
  const [priceHistory, setPriceHistory] = useState([]);

  useEffect(() => {
    const initModel = async () => {
      setIsTraining(true);
      
      const newModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      newModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      setModel(newModel);
      setIsTraining(false);
    };

    initModel();

    return () => {
      if (model) {
        model.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (tickData[symbol]) {
      const tick = tickData[symbol];
      setPriceHistory(prev => {
        const updated = [...prev, tick.quote];
        return updated.slice(-100);
      });
    }
  }, [tickData, symbol]);

  useEffect(() => {
    if (model && priceHistory.length >= 20) {
      makePrediction();
    }
  }, [priceHistory, model]);

  const makePrediction = async () => {
    if (!model || priceHistory.length < 20) return;

    try {
      const recentPrices = priceHistory.slice(-10);
      const normalized = normalizeData(recentPrices);
      
      const inputTensor = tf.tensor2d([normalized]);
      const predictionTensor = model.predict(inputTensor);
      const predictionValue = await predictionTensor.data();
      
      const confidenceValue = predictionValue[0];
      setPrediction(confidenceValue > 0.5 ? 'rise' : 'fall');
      setConfidence(confidenceValue > 0.5 ? confidenceValue : 1 - confidenceValue);

      inputTensor.dispose();
      predictionTensor.dispose();
    } catch (error) {
      console.error('Prediction error:', error);
    }
  };

  const normalizeData = (data) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map(val => (val - min) / range);
  };

  return {
    prediction,
    confidence,
    isTraining,
    priceHistory
  };
};
