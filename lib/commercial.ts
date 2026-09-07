export const PACKAGES = [
  { id: "small", name: "Estudio / 1D + 1B", sqm: 35, bedrooms: 1, bathrooms: 1, general: 37000, deep: 45000, delivery: 55000 },
  { id: "medium", name: "2D + 2B", sqm: 60, bedrooms: 2, bathrooms: 2, general: 47000, deep: 60000, delivery: 70000 },
  { id: "family", name: "3D + 2B", sqm: 85, bedrooms: 3, bathrooms: 2, general: 57000, deep: 72000, delivery: 85000 },
  { id: "large", name: "3D + 3B", sqm: 120, bedrooms: 3, bathrooms: 3, general: 77000, deep: 92000, delivery: null },
  { id: "four", name: "4D + 3B", sqm: 120, bedrooms: 4, bathrooms: 3, general: 82000, deep: 100000, delivery: null },
];
export const SCOPES = {
  general: "Pisos, polvo accesible, cama con ropa existente, orden ligero, baño completo incluida ducha, cocina y electrodomésticos por fuera, retiro de bolsas al punto de basura. Productos habituales y revisión final incluidos.",
  deep: "Incluye general más zócalos, puertas, manillas, marcos, limpieza bajo objetos pequeños, sarro superficial y desengrase exterior de cocina y campana. Cambio de sábanas si hay un juego limpio disponible.",
  delivery: "Propiedad vacía: limpieza profunda, interior de muebles de cocina y closets vacíos, muros lavables según material y balcón de hasta 5 m². Requiere fotos o video y confirmación previa.",
};
export const EXCLUSIONS = "No incluye vajilla acumulada, organización de pertenencias, interiores de electrodomésticos, vidrios, postobra, basura voluminosa, movimiento de muebles pesados ni trabajos en altura. General/profunda no incluyen interiores de muebles ni terraza. No se garantiza eliminar manchas permanentes. Cliente aporta aspiradora en buen estado cuando se requiera.";
export const COMMERCIAL_DEFAULTS = { packages: PACKAGES, costsConfirmed: false, targetTakeHome: 20000, parkingCost: 0, otherCost: 0, maxPropertiesPerDay: 2 as const };
