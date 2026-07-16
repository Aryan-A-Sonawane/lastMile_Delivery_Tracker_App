import { describe, it, expect } from "vitest";
import {
  resolveZoneType,
  resolveZoneIdByPincode,
  haversineKm,
  isWithinCircle,
  zoneForPoint,
  type ZoneCircle,
} from "../zones";

describe("resolveZoneType", () => {
  it("is INTRA for same zone, INTER for different", () => {
    expect(resolveZoneType("z1", "z1")).toBe("INTRA");
    expect(resolveZoneType("z1", "z2")).toBe("INTER");
  });
});

describe("resolveZoneIdByPincode", () => {
  const areas = [
    { pincode: "560001", zoneId: "north" },
    { pincode: "560041", zoneId: "south" },
  ];
  it("maps a serviced pincode to its zone", () => {
    expect(resolveZoneIdByPincode("560001", areas)).toBe("north");
    expect(resolveZoneIdByPincode(" 560041 ", areas)).toBe("south"); // trims
  });
  it("returns null for an unserviced pincode", () => {
    expect(resolveZoneIdByPincode("999999", areas)).toBeNull();
  });
});

describe("haversineKm", () => {
  it("is ~111 km per degree of latitude", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe("isWithinCircle", () => {
  it("respects the radius", () => {
    expect(isWithinCircle({ lat: 0.05, lng: 0 }, { lat: 0, lng: 0 }, 10)).toBe(true); // ~5.5 km
    expect(isWithinCircle({ lat: 0.2, lng: 0 }, { lat: 0, lng: 0 }, 10)).toBe(false); // ~22 km
  });
});

describe("zoneForPoint", () => {
  const zones: ZoneCircle[] = [
    { id: "small", centerLat: 0, centerLng: 0, radiusKm: 10 },
    { id: "big", centerLat: 0, centerLng: 0, radiusKm: 100 },
  ];

  it("picks the smallest containing circle when zones overlap", () => {
    expect(zoneForPoint({ lat: 0.05, lng: 0 }, zones)).toBe("small"); // ~5.5 km — inside both
  });

  it("falls back to the larger zone when outside the small one", () => {
    expect(zoneForPoint({ lat: 0.5, lng: 0 }, zones)).toBe("big"); // ~55 km — outside small, inside big
  });

  it("returns null when outside every zone", () => {
    expect(zoneForPoint({ lat: 2, lng: 0 }, zones)).toBeNull(); // ~222 km
  });
});
