// src/navigation/CustomTabBar.tsx

import React from 'react';
import { View, Pressable, Image, StyleSheet } from 'react-native';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useThemeStyles } from '../styles/theme'; // Import your theme

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: MaterialTopTabBarProps) {
  const { colors: c } = useThemeStyles();

  return (
    // This is the main bar. We make it transparent.
    <View style={[styles.container, { borderTopColor: c.border }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        // Get the icon function from your options
        const icon = options.tabBarIcon;
        if (!icon) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            // This is the magic!
            // The style prop can be a function.
            style={({ pressed }) => [
              styles.tabButton,
              {
                // Show a background if the tab is focused OR if it's being pressed
                backgroundColor: (isFocused || pressed)
                  ? c.backgroundAlt // Your old tab bar color
                  : 'transparent', // Otherwise, transparent
              },
            ]}
          >
            {/* Render the icon, passing in focused state and color */}
            {icon({
              focused: isFocused,
              color: isFocused ? c.primary : c.textSecondary,
            })}
          </Pressable>
        );
      })}
    </View>
  );
}

// Add some styles to make it look right
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 80,
    borderTopWidth: 1,
    backgroundColor: 'transparent', // Main bar is transparent
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 15, // Your original padding
    borderRadius: 16, // Add a nice rounded corner effect
    margin: 6, // Add some space around the pressable area
    height: 68, // Make it a bit smaller than the bar
    alignSelf: 'center',
  },
});