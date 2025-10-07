// src/contexts/LocationContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const LocationContext = createContext();

export function LocationProvider(props) {
  const [location] = useState({ latitude: 40.7128, longitude: -74.0060 });
  const [error] = useState(null);

  return React.createElement(
    LocationContext.Provider,
    { value: { location, error } },
    props.children
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
