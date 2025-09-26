'use strict';

let avoidPoints: number[][] = [];

export const loadResource = async () => {
  const response = await fetch('avoid_points.json');
  if (!response.ok) throw new Error('Failed to load resource');
  avoidPoints = await response.json();
}

export const getAvoidPoints = () => avoidPoints;
