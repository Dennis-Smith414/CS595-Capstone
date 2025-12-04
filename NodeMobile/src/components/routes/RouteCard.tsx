// components/routes/RouteCard.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  // 💡 ADDED: Pressable and Animated for double-tap/animation
  Pressable,
  Animated,
} from "react-native";
import { useThemeStyles } from "../../styles/theme";
import { createGlobalStyles } from "../../styles/globalStyles";
import RouteThumbnail from "./RouteThumbnail";

export type RouteCardItem = {
  id: number;
  slug: string;
  name: string;
  region?: string;
  upvotes?: number;
  start_lat?: number | null;
  start_lng?: number | null;
  rating_total?: number;
  user_rating?: 1 | -1 | null;
};

type Props = {
  item: RouteCardItem;
  isFavorite: boolean;
  isFavUpdating: boolean;
  isVoting: boolean;
  score: number;

  // interactions
  onToggleFavorite: () => void;
  onVoteUp: () => void;
  onVoteDown: () => void;
  onOpenComments: () => void;
  onOpenDetail: () => void;
};

export const RouteCard: React.FC<Props> = ({
  item,
  isFavorite,
  isFavUpdating,
  isVoting,
  score,
  onToggleFavorite,
  onVoteUp,
  onVoteDown,
  onOpenComments,
  onOpenDetail,
}) => {
  const { colors } = useThemeStyles();
  const globalStyles = createGlobalStyles(colors);

  const isUpvoted = item.user_rating === 1;
  const isDownvoted = item.user_rating === -1;

  // 💡 START: Double Tap and Animation Logic from TrailCard.tsx
  const [showHeart, setShowHeart] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  // Double Tap Logic Refs
  const lastTap = useRef<number | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const DOUBLE_PRESS_DELAY = 300;

  const triggerHeartAnimation = useCallback(() => {
    setShowHeart(true);
    scaleValue.setValue(0);
    opacityValue.setValue(1);

    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.delay(500),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowHeart(false));
  }, [scaleValue, opacityValue]);

  const handlePress = useCallback(
    (event: any) => {
      const now = Date.now();

      if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
        // --- DOUBLE TAP DETECTED ---
        if (timer.current) clearTimeout(timer.current); // Cancel the single tap action

        // 1. Get coordinates
        const { locationX, locationY } = event.nativeEvent;
        setTapPosition({ x: locationX, y: locationY });

        // 2. Trigger Upvote
        onVoteUp();

        // 3. Trigger Animation
        triggerHeartAnimation();

        lastTap.current = null;
      } else {
        // --- SINGLE TAP DETECTED ---
        lastTap.current = now;

        // Delay the detail screen navigation to wait for a potential second tap
        timer.current = setTimeout(() => {
          onOpenDetail();
          lastTap.current = null;
        }, DOUBLE_PRESS_DELAY);
      }
    },
    [onVoteUp, onOpenDetail, triggerHeartAnimation]
  );
  // 💡 END: Double Tap and Animation Logic

  return (
    // 💡 Changed outer View to Pressable to handle the tap logic
    <Pressable
      onPress={handlePress}
      style={[
        styles.cardContainer,
        {
          borderColor: colors.accent,
          backgroundColor: colors.backgroundAlt,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {/* LEFT: title / region – NO onPress HERE, handled by outer Pressable */}
        <View style={styles.titleArea}>
          <Text
            style={[
              globalStyles.bodyText,
              {
                color: colors.textPrimary,
              },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {item.region && (
            <Text
              style={[
                globalStyles.subText,
                {
                  color: colors.textSecondary,
                  marginTop: 2,
                },
              ]}
              numberOfLines={1}
            >
              {item.region}
            </Text>
          )}
        </View>

        {/* MIDDLE: tiny trail outline (from main branch) */}
        <View style={styles.thumbnailWrapper}>
          <RouteThumbnail routeId={item.id} width={70} height={40} />
        </View>

        {/* RIGHT: favorites + votes (remains the same for explicit button taps) */}
        <View style={styles.rightColumn}>
          {/* Favorite toggle */}
          <TouchableOpacity
            onPress={onToggleFavorite}
            disabled={isFavUpdating}
            style={styles.favoriteButton}
          >
            <Text
              style={{
                fontSize: 18,
                opacity: isFavUpdating ? 0.5 : 1,
                color: isFavorite ? colors.accent : colors.textSecondary,
              }}
            >
              {isFavorite ? "★" : "☆"}
            </Text>
          </TouchableOpacity>

          {/* Upvote */}
          <TouchableOpacity
            onPress={onVoteUp}
            disabled={isVoting}
            style={styles.voteButtonWrapper}
          >
            <Text
              style={{
                fontSize: 18,
                color: isUpvoted ? colors.accent : colors.textSecondary,
              }}
            >
              ▲
            </Text>
          </TouchableOpacity>

          {/* Downvote */}
          <TouchableOpacity
            onPress={onVoteDown}
            disabled={isVoting}
            style={styles.voteButtonWrapper}
          >
            <Text
              style={{
                fontSize: 18,
                color: isDownvoted
                  ? colors.error || "#d33"
                  : colors.textSecondary,
              }}
            >
              ▼
            </Text>
          </TouchableOpacity>

          {/* Score */}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginTop: -2,
            }}
          >
            {score}
          </Text>
        </View>
      </View>

      {/* 💡 Heart Animation Overlay */}
      {showHeart && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: tapPosition.y - 40,
            left: tapPosition.x - 40,
            transform: [{ scale: scaleValue }],
            opacity: opacityValue,
            zIndex: 10,
          }}
        >
          <Text style={{ fontSize: 80 }}>❤️</Text>
        </Animated.View>
      )}

      {/* Footer: comments link */}
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={onOpenComments}>
          <Text
            style={{
              color: colors.accent,
              fontSize: 13,
            }}
          >
            View comments
          </Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleArea: {
    flex: 1,
    padding: 12,
  },
  thumbnailWrapper: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 8,
  },
  rightColumn: {
    paddingRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  voteButtonWrapper: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  footerRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
});

export default RouteCard;