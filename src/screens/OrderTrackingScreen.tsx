import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiGet } from "@/services/api";
import { GeoPoint, OrderStatus, RootStackParamList } from "@/types";

type TrackingResponse = {
  success?: boolean;
  data?: {
    orderId: string;
    status: OrderStatus;
    deliveryAddress: string;
    deliveryLocation?: GeoPoint;
    restaurantLocation?: GeoPoint;
    tracking?: { latitude: number; longitude: number; heading?: number; updatedAt?: string; isActive?: boolean } | null;
  };
};

const isPoint = (point?: GeoPoint | null): point is GeoPoint =>
  !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
  Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;

const pickupPhase = (status: OrderStatus) =>
  ["DRIVER_ASSIGNED", "READY_FOR_PICKUP"].includes(status);

export default function OrderTrackingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OrderTracking">>();
  const map = useRef<MapView>(null);
  const didFit = useRef(false);
  const [data, setData] = useState<TrackingResponse["data"]>();
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await apiGet<TrackingResponse>(`/tracking/orders/${encodeURIComponent(route.params.orderId)}`);
      if (!response?.data) throw new Error("Order tracking details are unavailable.");
      setData(response.data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh tracking.");
    }
  }, [route.params.orderId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const driverPoint = data?.tracking ? { latitude: data.tracking.latitude, longitude: data.tracking.longitude } : null;
  const pickup = isPoint(data?.restaurantLocation) ? data.restaurantLocation : null;
  const destination = isPoint(data?.deliveryLocation) ? data.deliveryLocation : null;
  const target = data && pickupPhase(data.status) ? pickup : destination;
  const subtitle = !data ? "Loading live order details…" :
    data.status === "DELIVERED" ? "Order delivered" :
    data.status === "CANCELLED" ? "Order cancelled" :
    !driverPoint ? "Waiting for your driver’s location" :
    pickupPhase(data.status) ? "Your driver is heading to the restaurant" : "Your driver is heading to you";

  const fitPoints = useMemo(() => [driverPoint, pickup, destination].filter(isPoint), [driverPoint, pickup, destination]);
  useEffect(() => {
    if (fitPoints.length && !didFit.current) {
      if (fitPoints.length > 1) map.current?.fitToCoordinates(fitPoints, { edgePadding: { top: 120, right: 50, bottom: 230, left: 50 }, animated: true });
      else map.current?.animateToRegion({ ...fitPoints[0], latitudeDelta: 0.025, longitudeDelta: 0.025 }, 500);
      didFit.current = true;
    }
  }, [fitPoints]);
  useEffect(() => { didFit.current = false; }, [route.params.orderId]);

  const initial: Region = {
    latitude: destination?.latitude ?? pickup?.latitude ?? 6.9271,
    longitude: destination?.longitude ?? pickup?.longitude ?? 79.8612,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      {(pickup || destination || driverPoint) ? (
        <MapView ref={map} className="flex-1" initialRegion={initial} showsUserLocation={false} showsCompass>
          {pickup ? <Marker coordinate={pickup} title="Restaurant · pickup" pinColor="#16a34a" /> : null}
          {destination ? <Marker coordinate={destination} title="Your delivery address" description={data?.deliveryAddress} pinColor="#dc2626" /> : null}
          {driverPoint ? <Marker coordinate={driverPoint} title="Your driver" description="Latest reported location" pinColor="#2563eb" /> : null}
          {driverPoint && target ? <Polyline coordinates={[driverPoint, target]} strokeColor="#16a34a" strokeWidth={5} lineDashPattern={[1, 0]} /> : null}
          {!driverPoint && pickup && destination ? <Polyline coordinates={[pickup, destination]} strokeColor="#94a3b8" strokeWidth={3} lineDashPattern={[4, 5]} /> : null}
        </MapView>
      ) : <View className="flex-1 items-center justify-center px-8"><Ionicons name="map-outline" size={52} color="#94a3b8" /><Text className="mt-4 text-center font-semibold text-slate-700">Map pins will appear when the order and driver locations are available.</Text></View>}

      <View className="absolute top-3 left-4 right-4 flex-row items-center rounded-2xl bg-white p-3 shadow">
        <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"><Ionicons name="arrow-back" size={20} color="#334155" /></Pressable>
        <View className="ml-3 flex-1"><Text className="font-bold text-slate-900">Track your order</Text><Text className="mt-0.5 text-xs text-slate-500">#{route.params.orderId.slice(-6).toUpperCase()}</Text></View>
        <Pressable onPress={() => { didFit.current = false; void refresh(); }} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"><Ionicons name="refresh" size={19} color="#334155" /></Pressable>
      </View>

      <View className="absolute bottom-4 left-4 right-4 rounded-3xl bg-white p-5 shadow-lg">
        <View className="flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-full bg-green-100"><Ionicons name={driverPoint ? "bicycle" : "time-outline"} size={23} color="#15803d" /></View><View className="ml-3 flex-1"><Text className="font-bold text-slate-900">{subtitle}</Text><Text className="mt-1 text-xs text-slate-500">{data?.status?.replaceAll("_", " ") ?? "Connecting…"}</Text></View>{!data ? <ActivityIndicator color="#16a34a" /> : null}</View>
        <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{pickupPhase(data?.status ?? "PENDING") ? "Pickup location" : "Delivery address"}</Text>
        <Text className="mt-1 text-sm leading-5 text-slate-700">{pickupPhase(data?.status ?? "PENDING") ? (pickup ? "Restaurant pickup point" : "Restaurant pin is not available") : (data?.deliveryAddress || "Delivery address unavailable")}</Text>
        {driverPoint && data?.tracking?.updatedAt ? <Text className="mt-2 text-xs text-slate-400">Location updated {new Date(data.tracking.updatedAt).toLocaleTimeString()}</Text> : null}
        {error ? <Text className="mt-2 text-xs text-red-600">{error}</Text> : null}
        <Text className="mt-3 text-[11px] text-slate-400">The line shows the direct map connection. Road-following directions need a Maps key.</Text>
      </View>
    </SafeAreaView>
  );
}
