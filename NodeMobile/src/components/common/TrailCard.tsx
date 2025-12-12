import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useThemeStyles } from '../../styles/theme'; // Adjust path if needed
import { Card } from './Card'; // Adjust path to your common Card
import Icon from 'react-native-vector-icons/Ionicons';


interface TrailCardProps {
  item: any; // or RouteItem type
  isSelected: boolean;
  isFavorite: boolean;
  isSyncing: boolean; // <--- NEW PROP
  onSelect: () => void;
  onFavorite: () => void;
  onUpvote: () => void;
  onSync: () => void; // <--- NEW PROP
  onCommentPress: () => void;
}

const TrailCard: React.FC<TrailCardProps> = ({
  item,
  isSelected,
  isFavorite,
  isSyncing, // <--- Destructure new prop
  onSelect,
  onFavorite,
  onUpvote,
  onSync,    // <--- Destructure new prop
  onCommentPress,
}) => {
  const { colors } = useThemeStyles();

  // Animation State
  const [showHeart, setShowHeart] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  // Double Tap Logic Refs
  const lastTap = useRef<number | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const handlePress = (event: any) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      // --- DOUBLE TAP DETECTED ---
      if (timer.current) clearTimeout(timer.current); // Cancel the single tap action

      // 1. Get coordinates
      const { locationX, locationY } = event.nativeEvent;
      setTapPosition({ x: locationX, y: locationY });

      // 2. Trigger Upvote
      onUpvote();

      // 3. Trigger Animation
      triggerHeartAnimation();

      lastTap.current = null;
    } else {
      // --- SINGLE TAP DETECTED ---
      lastTap.current = now;

      // Delay the selection slightly to wait for a potential second tap
      timer.current = setTimeout(() => {
        onSelect();
        lastTap.current = null;
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const triggerHeartAnimation = () => {
    setShowHeart(true);
    scaleValue.setValue(0);
    opacityValue.setValue(1);

    Animated.sequence([
      Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.delay(500),
      Animated.timing(opacityValue, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowHeart(false));
  };

  // Dynamic Styles based on selection
  const cardStyles = {
    backgroundColor: isSelected ? colors.primary : colors.backgroundAlt,
    borderColor: colors.accent,
    borderWidth: 1,
  };

  const textColor = isSelected ? colors.background : colors.textPrimary;
  const subTextColor = isSelected ? colors.background : colors.textSecondary;

  return (
    <Pressable onPress={handlePress} style={{ marginVertical: 6, marginHorizontal: 16 }}>
      <Card style={cardStyles}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>

          {/* Left Side: Name & Region */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor }}>
              {item.name}
            </Text>
            {item.region && (
              <Text style={{ fontSize: 12, color: subTextColor, marginTop: 2 }}>
                {item.region}
              </Text>
            )}
          </View>

          {/* Right Side: Actions */}
          <View style={{ alignItems: "center", justifyContent: "center", paddingLeft: 12 }}>
          {/* 1. Download / Sync Button (NEW) */}
            <TouchableOpacity
                onPress={onSync}
                disabled={isSyncing}
                style={{ padding: 4, marginBottom: 4 }}
            >
            {isSyncing ? (
                <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                // Use "cloud-download-outline" or similar
                <Icon name="cloud-download-outline" size={20} color={colors.textSecondary} />
                )}
            </TouchableOpacity>
            {/* Favorite Star */}
            <TouchableOpacity onPress={onFavorite} style={{ padding: 4 }}>
              <Text style={{ fontSize: 18, color: isFavorite ? colors.accent : colors.textSecondary }}>
                {isFavorite ? "★" : "☆"}
              </Text>
            </TouchableOpacity>

            {/* Upvote Arrow & Count */}
            <TouchableOpacity onPress={onUpvote} style={{ padding: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 18 }}>▲</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: -2 }}>
              {item.rating_total ?? item.upvotes ?? 0}
            </Text>
          </View>
        </View>

        {/* Footer: Comments Link */}
        <View style={{ paddingTop: 8 }}>
          <TouchableOpacity onPress={onCommentPress}>
            <Text style={{ color: colors.accent, fontSize: 13 }}>
              View comments
            </Text>
          </TouchableOpacity>
        </View>

        {/* Heart Animation Overlay */}
        {showHeart && (
          <Animated.View
            style={{
              position: 'absolute',
              top: tapPosition.y - 40, // Center offset
              left: tapPosition.x - 40,
              transform: [{ scale: scaleValue }],
              opacity: opacityValue,
              zIndex: 10,
            }}
          >
             {/* Replace with your Icon component if needed */}
             <Text style={{ fontSize: 80 }}>❤️</Text>
          </Animated.View>
        )}
      </Card>
    </Pressable>
  );
};

export default TrailCard;