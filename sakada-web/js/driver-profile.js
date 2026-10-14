// The signed-in driver's own vehicle details. RLS (0005) lets a driver read
// and update only their own driver_profiles row.
import { supabase } from "./supabase-client.js";

export async function getMyVehicle(driverId) {
  return await supabase
    .from("driver_profiles")
    .select("vehicle_type, vehicle_plate")
    .eq("id", driverId)
    .maybeSingle();
}

export async function saveMyVehicle(driverId, vehicleType, vehiclePlate) {
  return await supabase
    .from("driver_profiles")
    .update({
      vehicle_type: vehicleType.trim().slice(0, 40) || null,
      vehicle_plate: vehiclePlate.trim().toUpperCase().slice(0, 15) || null,
    })
    .eq("id", driverId);
}
