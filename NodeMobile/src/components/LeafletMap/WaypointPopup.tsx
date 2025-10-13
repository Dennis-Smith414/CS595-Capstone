import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { colors } from "../../styles/theme";
import { useDistanceUnit } from "../../context/DistanceUnitContext";
import { useAuth } from "../../context/AuthContext";
import { fetchWaypointRating, submitWaypointVote } from "../../lib/ratings";

interface WaypointPopupProps {
  visible: boolean;
  id?: number;
  name: string;
  description: string;
  type: string;
  username: string;
  dateUploaded: string;
  distance?: number;
  onExpand: () => void;
  onClose: () => void;
  iconRequire?: any;
}

export const WaypointPopup: React.FC<WaypointPopupProps> = ({
  visible,
  id,
  name,
  description,
  type,
  username,
  dateUploaded,
  distance,
  onExpand,
  onClose,
  iconRequire,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { convertDistance } = useDistanceUnit();
  const { userToken } = useAuth();

  const [displayData, setDisplayData] = useState({
    name: "",
    description: "",
    type: "generic",
    username: "",
    dateUploaded: "",
    distance: undefined as number | undefined,
  });

  const [userRating, setUserRating] = useState<number | null>(null);
  const [loadingVote, setLoadingVote] = useState(false);
  const [totalVotes, setTotalVotes] = useState(0);

  // --- Load waypoint details when visible ---
  useEffect(() => {
    if (visible) {
      setDisplayData({
        name,
        description,
        type,
        username,
        dateUploaded,
        distance,
      });

      // Fetch live rating when popup opens
      if (id && userToken) {
        fetchWaypointRating(id, userToken)
          .then((r) => {
            setTotalVotes(r.total);
            setUserRating(r.user_rating);
          })
          .catch((err) => console.warn("Failed to fetch rating:", err));
      }
    }
  }, [visible, id, name, description, type, username, dateUploaded, distance, userToken]);

  // --- Animate in/out ---
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) {
        setDisplayData({
          name: "",
          description: "",
          username: "",
          dateUploaded: "",
          distance: undefined,
        });
        setUserRating(null);
      }
    });
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [150, 0],
  });

  if (!visible && slideAnim.__getValue() === 0) return null;

  // --- Voting handler ---
const handleVote = async (val: 1 | -1) => {
  if (!id || !userToken || loadingVote) {
    console.warn("⚠️ Missing id/token or already voting", { id, userToken, loadingVote });
    return;
  }

  setLoadingVote(true);

  try {
    const result = await submitWaypointVote(id, val, userToken);
    setTotalVotes(result.total);
    setUserRating(result.user_rating);
  } catch (err) {
    console.error("❌ Vote failed:", err);
  } finally {
    setLoadingVote(false);
  }
};



  // --- Formatting ---
  const formattedDate = displayData.dateUploaded
    ? new Date(displayData.dateUploaded).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const formattedDistance =
    displayData.distance !== undefined
      ? convertDistance(displayData.distance)
      : "";

  const isMarkedLocation =
    !displayData.name || displayData.name === "Marked Location";

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity: slideAnim },
      ]}
    >
      <View style={styles.row}>
        {/* === Expandable Info Section === */}
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.9}
          onPress={onExpand}
        >
          <View style={styles.infoSection}>
            {iconRequire ? (
              <Image
                source={iconRequire || require("../../assets/icons/waypoints/generic.png")}
                style={styles.iconImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.iconImage, styles.placeholderIcon]} />
            )}

            <View style={styles.info}>
              <Text style={styles.title}>{displayData.name || "Waypoint"}</Text>
              {!isMarkedLocation && (
                <Text style={styles.desc} numberOfLines={2}>
                  {displayData.description || "No description provided."}
                </Text>
              )}
              <Text style={styles.meta}>
                {formattedDate}{" "}
                {displayData.username ? `• ${displayData.username}` : ""}
                {formattedDistance ? ` • ${formattedDistance}` : ""}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* === Voting Section === */}
        {!isMarkedLocation && (
          <View style={styles.voteContainer}>
            <TouchableOpacity
              onPress={() => handleVote(1)}
              disabled={loadingVote}
            >
              <Text
                style={[
                  styles.voteButton,
                  userRating === 1 && { color: colors.accent },
                ]}
              >
                ⬆️
              </Text>
            </TouchableOpacity>

            <Text style={styles.voteCount}>{totalVotes}</Text>

            <TouchableOpacity
              onPress={() => handleVote(-1)}
              disabled={loadingVote}
            >
              <Text
                style={[
                  styles.voteButton,
                  userRating === -1 && { color: colors.error || "#d33" },
                ]}
              >
                ⬇️
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  row: { flexDirection: "row", alignItems: "center" },
  iconImage: {
    width: 36,
    height: 36,
    marginRight: 12,
    borderRadius: 8,
  },
  placeholderIcon: { backgroundColor: "#ddd" },
  info: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  meta: { fontSize: 12, color: colors.textSecondary },
  voteContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  voteButton: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  voteCount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  createButton: {
    marginTop: 12,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
});
