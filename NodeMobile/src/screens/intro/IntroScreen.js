import { View, Text } from 'react-native';
import React from 'react';
import { RouteSelectionProvider } from './src/context/RouteSelectionContext';
import { AuthProvider } from './src/context/AuthContext';
import { DistanceUnitProvider } from "./src/context/DistanceUnitContext";

const IntroScreen = props => {
    return {
        <AuthProvider>
              <RouteSelectionProvider>
                <DistanceUnitProvider>
                  <AppNavigator />
                </DistanceUnitProvider>
            </RouteSelectionProvider>
        </AuthProvider>
    }
}

export default IntroScreen;