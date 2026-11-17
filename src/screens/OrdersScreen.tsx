import React, { useEffect, useState } from "react";
import { View, Text, FlatList, SafeAreaView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/services/api";
import { Order, OrderStatus, RootStackParamList } from "@/types";

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; icon: string }
> = {
  PENDING: { label: "Pending", color: "#FFB703", icon: "time-outline" },
  CONFIRMED: {
    label: "Confirmed",
    color: "#2196F3",
    icon: "checkmark-done-outline",
  },
  PREPARING: {
    label: "Preparing",
    color: "#5E9F2D",
    icon: "restaurant-outline",
  },
  READY_FOR_PICKUP: {
    label: "Ready",
    color: "#4CAF50",
    icon: "bicycle-outline",
  },
  DRIVER_ASSIGNED: {
    label: "Driver assigned",
    color: "#4CAF50",
    icon: "person-outline",
  },
  PICKED_UP: {
    label: "Picked up",
    color: "#2EC4B6",
    icon: "bicycle-outline",
  },
  DELIVERING: {
    label: "Delivering",
    color: "#2EC4B6",
    icon: "bicycle-outline",
  },
  ARRIVED: {
    label: "Arrived",
    color: "#4CAF50",
    icon: "location-outline",
  },
  OUT_FOR_DELIVERY: {
    label: "On the way",
    color: "#2EC4B6",
    icon: "bicycle-outline",
  },
  DELIVERED: {
    label: "Delivered",
    color: "#4CAF50",
    icon: "checkmark-circle-outline",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#E53935",
    icon: "close-circle-outline",
  },
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orders, loadOrders } = useCart();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPendingOrders = async () => {
      if (!user?._id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiGet<{
          success: boolean;
          data: Order[];
        }>(`/order/user/${encodeURIComponent(user._id)}`);

        loadOrders(Array.isArray(response.data) ? response.data : []);
      } catch (err: any) {
        setError(err.message || "Unable to load pending orders.");
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      fetchPendingOrders();
    }
  }, [user, isFocused]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-dark text-base">Loading orders...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-dark text-base text-center">
          Please login to view your orders.
        </Text>
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Ionicons name="receipt-outline" size={64} color="#22C55E" />
        <Text className="text-neutral-500 text-base mt-4">No orders yet</Text>
        {error ? (
          <Text className="text-red-500 text-sm mt-2">{error}</Text>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Text className="text-dark font-bold text-2xl px-4 pt-4 mb-2">
        Your Orders
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        renderItem={({ item: order }) => {
          const orderItems = Array.isArray(order.items) ? order.items : [];
          const status = statusConfig[order.status] ?? {
            label: "Order received",
            color: "#6B7280",
            icon: "help-circle-outline",
          };
          const totalAmount = Number(order.totalAmount ?? order.totalPrice ?? 0);
          const firstItemName = orderItems[0]?.name || "Order";
          return (
            <View className="bg-white rounded-3xl p-4 mb-4">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <Text className="text-dark font-semibold text-base">
                    {firstItemName}
                  </Text>
                  <Text className="text-muted text-sm mt-1">
                    {orderItems.length} item(s) · $
                    {totalAmount.toFixed(2)}
                  </Text>
                </View>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: `${status.color}22` }}
                >
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: status.color }}
                  >
                    {status.label}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between items-center mt-4">
                <Text className="text-muted text-xs">
                  {new Date(order.createdAt).toLocaleDateString()}
                </Text>
                <Ionicons
                  name={status.icon as any}
                  size={18}
                  color={status.color}
                />
              </View>
              {order.status !== "DELIVERED" && order.status !== "CANCELLED" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate("OrderTracking", { orderId: order._id })
                  }
                  className="mt-3 min-h-11 flex-row items-center justify-center rounded-xl bg-green-600"
                >
                  <Ionicons name="navigate-outline" size={17} color="white" />
                  <Text className="ml-2 font-bold text-white">Track order</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
