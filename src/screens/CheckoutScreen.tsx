import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { RootStackParamList } from "@/types";
import { apiPost } from "@/services/api";
import { GeoPoint, Order, PaymentMethod } from "@/types";

const paymentMethods = ["Cash on Delivery", "Card", "Wallet"];

export default function CheckoutScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { cart, cartTotal, clearCart, placeOrder, updateQuantity } = useCart();
  const [payment, setPayment] = useState(paymentMethods[0]);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<GeoPoint | null>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<GeoPoint | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const deliveryFee = 1.99;
  const total = cartTotal + deliveryFee;

  useEffect(() => {
    if (user) {
      setPhone(user.phone ?? "");
      setAddress(user.address ?? "");
    }
  }, [user]);

  const captureDeliveryLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Allow location access to add the delivery pin.");
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDeliveryLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      const cartRestaurant = cart[0];
      if (cartRestaurant?.restaurantLocation) {
        setRestaurantLocation(cartRestaurant.restaurantLocation);
      } else if (cartRestaurant?.restaurantAddress?.trim()) {
        const result = await Location.geocodeAsync(
          cartRestaurant.restaurantAddress.trim(),
        );
        const match = result[0];
        if (match) {
          setRestaurantLocation({
            latitude: match.latitude,
            longitude: match.longitude,
          });
        } else {
          setLocationError("Could not map the restaurant address. Please contact the restaurant.");
        }
      } else {
        setLocationError("Restaurant address is missing, so its map pin cannot be set.");
      }
    } catch (cause) {
      setLocationError(
        cause instanceof Error ? cause.message : "Could not get your location.",
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const mapPaymentMethod = (method: string): PaymentMethod => {
    if (method === "Card") return "CARD";
    if (method === "Wallet") return "ONLINE";
    return "CASH";
  };

  const handlePlaceOrder = async () => {
    setError(null);
    if (!user) {
      setError("Please login before placing an order.");
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!user._id) {
      setError("Your login session is incomplete. Please log out and log in again.");
      return;
    }

    const deliveryAddress = address.trim();
    if (deliveryAddress.length < 5) {
      setError("Please enter a delivery address of at least 5 characters.");
      return;
    }

    const deliveryPhone = (phone || user.phone || "").trim();
    if (deliveryPhone.length < 7 || deliveryPhone.length > 20) {
      setError("Please enter a valid phone number (7–20 characters).");
      return;
    }

    if (!deliveryLocation) {
      setError("Add your delivery pin using the location button before placing the order.");
      return;
    }

    if (!restaurantLocation) {
      setError(locationError || "Could not find the restaurant map pin. Try setting your location again.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: user._id,
        restaurantId: cart[0].restaurantId,
        items: cart.map((c) => ({
          name: c.item.name,
          quantity: c.quantity,
          price: c.item.price,
        })),
        deliveryAddress,
        phoneNumber: deliveryPhone,
        deliveryLocation,
        restaurantLocation,
        subtotal: cartTotal,
        deliveryFee,
        totalAmount: total,
        paymentMethod: mapPaymentMethod(payment),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };

      const res = await apiPost<{
        success: boolean;
        message?: string;
        data: Order;
      }>("/order", payload);

      const order = res?.data as Order;
      placeOrder(order);
      setPlacedOrderId(order._id);
      clearCart();
      setSuccessVisible(true);
    } catch (err: any) {
      setError(err.message || "Unable to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessVisible(false);
    if (placedOrderId) {
      navigation.navigate("OrderTracking", { orderId: placedOrderId });
    } else {
      navigation.navigate("MainTabs", { screen: "Orders" });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="px-4 pt-5">
        <View className="flex-row justify-between items-end mb-5">
          <View>
            <Text className="text-neutral-500 text-sm">Checkout</Text>
            <Text className="text-black font-bold text-3xl">Your Basket</Text>
          </View>
          <View className="bg-green-500 px-4 py-2 rounded-full">
            <Text className="text-white text-sm">{cart.length} items</Text>
          </View>
        </View>

        <View className="bg-white rounded-[32px] p-5 mb-4">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-black font-semibold text-base">
                Delivery Address
              </Text>
              <Text className="text-muted text-sm mt-1">
                Where should we deliver your order?
              </Text>
            </View>
            <Ionicons name="location-outline" size={24} color="#22C55E" />
          </View>
          <TextInput
            className="rounded-3xl px-4 py-4 text-base text-gray-900 bg-slate-50"
            placeholder="Enter delivery address"
            placeholderTextColor="#9ca3af"
            value={address}
            onChangeText={setAddress}
          />
          <View className="mt-4 rounded-3xl bg-slate-50 p-3">
            <View className="flex-row items-center">
              <Ionicons
                name={deliveryLocation ? "location" : "map-outline"}
                size={18}
                color={deliveryLocation ? "#22C55E" : "#64748b"}
              />
              <Text className="ml-3 flex-1 text-sm text-gray-700">
                {deliveryLocation
                  ? `Delivery pin set · ${deliveryLocation.latitude.toFixed(5)}, ${deliveryLocation.longitude.toFixed(5)}`
                  : "Add your map pin so the driver can find you"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => void captureDeliveryLocation()}
              disabled={locationLoading}
              className="mt-3 min-h-12 flex-row items-center justify-center rounded-2xl bg-green-600 px-4"
            >
              {locationLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="locate" size={18} color="white" />
                  <Text className="ml-2 font-semibold text-white">
                    {deliveryLocation ? "Refresh delivery pin" : "Use current location"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {locationError ? (
              <Text className="mt-2 text-xs text-red-600">{locationError}</Text>
            ) : null}
          </View>
        </View>

        <View className="bg-white rounded-[32px] p-5 mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <View>
              <Text className="text-black font-semibold text-base">
                Order Notes
              </Text>
              <Text className="text-muted text-sm mt-1">
                Add any special instructions (optional)
              </Text>
            </View>
            <Ionicons name="create-outline" size={22} color="#22C55E" />
          </View>
          <TextInput
            className="rounded-2xl px-4 py-3 text-base text-gray-900 bg-slate-50 h-24"
            placeholder="For example: no onions, please call on arrival"
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text className="text-muted text-xs text-right mt-2">
            {notes.length}/500
          </Text>
        </View>

        <View className="bg-white/95 rounded-[32px] p-5 mb-4">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-black font-semibold text-base">
                Order Items
              </Text>
              <Text className="text-muted text-sm mt-1">
                Swipe or tap to edit quantities
              </Text>
            </View>
            <Ionicons name="basket-outline" size={24} color="#22C55E" />
          </View>
          {cart.map((c) => (
            <View
              key={c.item.id}
              className="flex-row items-center justify-between mb-4"
            >
              <View className="flex-1 pr-3">
                <Text className="text-dark font-semibold">{c.item.name}</Text>
                <Text className="text-muted text-sm mt-1">
                  ${c.item.price.toFixed(2)} each
                </Text>
              </View>
              <View className="flex-row items-center bg-gray-50 rounded-full px-3 py-2">
                <TouchableOpacity
                  onPress={() => updateQuantity(c.item.id, -1)}
                  activeOpacity={0.8}
                  className="p-1 rounded-full"
                >
                  <Ionicons
                    name="remove-circle-outline"
                    size={22}
                    color="#22C55E"
                  />
                </TouchableOpacity>
                <Text className="px-4 text-dark font-semibold">
                  {c.quantity}
                </Text>
                <TouchableOpacity
                  onPress={() => updateQuantity(c.item.id, 1)}
                  activeOpacity={0.8}
                  className="p-1 rounded-full"
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color="#22C55E"
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View className="bg-white rounded-[32px] p-5 mb-4">
          <Text className="text-dark font-semibold text-base mb-4">
            Payment Method
          </Text>
          <View className="flex-row justify-between gap-2">
            {paymentMethods.map((method) => {
              const active = payment === method;
              return (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPayment(method)}
                  activeOpacity={0.85}
                  className={`flex-1 rounded-3xl px-4 py-3 ${
                    active ? "bg-black" : "bg-slate-50"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${active ? "text-white" : "text-dark"}`}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className="text-muted text-sm mt-3">
            {payment === "Cash on Delivery"
              ? "Pay when food arrives"
              : "Secure online payment."}
          </Text>
        </View>

        <View className="bg-white rounded-[32px] p-5 mb-28">
          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Subtotal</Text>
            <Text className="text-dark font-semibold">
              ${cartTotal.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Delivery fee</Text>
            <Text className="text-dark font-semibold">
              ${deliveryFee.toFixed(2)}
            </Text>
          </View>
          <View className="pt-4 flex-row justify-between items-center">
            <Text className="text-dark font-bold text-lg">Total</Text>
            <Text className="text-black font-bold text-lg">
              ${total.toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {error ? (
        <View className="absolute bottom-24 left-4 right-4 bg-red-100 rounded-3xl p-3">
          <Text className="text-red-700 text-sm text-center">{error}</Text>
        </View>
      ) : null}

      <View className="absolute bottom-6 left-4 right-4">
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.85}
          className={`rounded-[30px] py-4 items-center ${
            loading ? "bg-gray-400" : "bg-green-500"
          }`}
        >
          <Text className="text-white font-bold text-base">
            {loading ? "Placing order..." : `Checkout · $${total.toFixed(2)}`}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={successVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/30 justify-center items-center px-6">
          <View className="w-full bg-white rounded-3xl p-6">
            <View className="bg-green-100 w-16 h-16 rounded-full items-center justify-center mb-5">
              <Ionicons name="checkmark" size={28} color="#2E7D32" />
            </View>
            <Text className="text-dark font-bold text-2xl mb-3">
              Order successfully placed!
            </Text>
            <Text className="text-muted text-sm mb-6">
              Your order is now being prepared. Track it in the Orders tab.
            </Text>
            <TouchableOpacity
              onPress={handleSuccessClose}
              activeOpacity={0.85}
              className="bg-green-500 rounded-3xl py-4 items-center"
            >
              <Text className="text-white font-semibold">View Orders</Text>
            </TouchableOpacity>
            <Pressable
              onPress={() => setSuccessVisible(false)}
              className="mt-4 items-center"
            >
              <Text className="text-muted text-sm">Continue browsing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
