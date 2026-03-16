// EVE Frontier module CPU/PG data — extracted from in-game wiki screenshots 2026-03-13
// cpu: tf (teraflops), pg: MW (megawatts)
// 123 modules extracted from 123 screenshots
// Note: Synthetic items (shells/implants) are omitted — they have no CPU/PG fitting cost
// Note: Cargo Grid modules show no CPU usage in-game (cpu: 0 is accurate)

export const MODULE_STATS: Record<string, { cpu: number; pg: number; name: string; slot?: string }> = {

  // ── CRUDE ENGINES ───────────────────────────────────────────────────────────
  "velocity_cd81": { name: "Velocity CD81", cpu: 10, pg: 20, slot: "engine" },
  "velocity_cd82": { name: "Velocity CD82", cpu: 35, pg: 50, slot: "engine" },
  "tempo_cd41":    { name: "Tempo CD41",    cpu: 10, pg: 18, slot: "engine" },
  "tempo_cd42":    { name: "Tempo CD42",    cpu: 35, pg: 45, slot: "engine" },
  "tempo_cd43":    { name: "Tempo CD43",    cpu: 40, pg: 180, slot: "engine" },
  "celerity_cd01": { name: "Celerity CD01", cpu: 10, pg: 16, slot: "engine" },
  "celerity_cd02": { name: "Celerity CD02", cpu: 35, pg: 40, slot: "engine" },
  "celerity_cd03": { name: "Celerity CD03", cpu: 40, pg: 160, slot: "engine" },

  // ── HYDROGEN ENGINES ────────────────────────────────────────────────────────
  "sojourn": { name: "Sojourn", cpu: 3, pg: 5, slot: "engine" },
  "embark":  { name: "Embark",  cpu: 2, pg: 4, slot: "engine" },

  // ── HEAT EJECTORS ───────────────────────────────────────────────────────────
  "heat_exchanger_xs":  { name: "Heat Exchanger XS",  cpu: 4,  pg: 8,  slot: "low" },
  "heat_exchanger_s":   { name: "Heat Exchanger S",   cpu: 10, pg: 20, slot: "low" },
  "cryogenic_ejector_s": { name: "Cryogenic Ejector S", cpu: 3, pg: 12, slot: "low" },

  // ── ARMOR REPAIRERS ─────────────────────────────────────────────────────────
  "systematic_armor_restorer_ii":  { name: "Systematic Armor Restorer II",  cpu: 5, pg: 10,  slot: "medium" },
  "systematic_armor_restorer_iii": { name: "Systematic Armor Restorer III", cpu: 6, pg: 290, slot: "medium" },
  "systematic_armor_restorer_iv":  { name: "Systematic Armor Restorer IV",  cpu: 7, pg: 295, slot: "medium" },

  // ── ARMOR HARDENERS — Nanitic Braces ────────────────────────────────────────
  "thermalnetic_nanitic_brace_ii":      { name: "Thermalnetic Nanitic Brace II",      cpu: 4, pg: 8,  slot: "medium" },
  "thermalnetic_nanitic_brace_iii":     { name: "Thermalnetic Nanitic Brace III",     cpu: 6, pg: 20, slot: "medium" },
  "thermalnetic_nanitic_brace_iv":      { name: "Thermalnetic Nanitic Brace IV",      cpu: 8, pg: 35, slot: "medium" },
  "thermal-electro_nanitic_brace_ii":   { name: "Thermal-electro Nanitic Brace II",   cpu: 4, pg: 8,  slot: "medium" },
  "thermal-electro_nanitic_brace_iii":  { name: "Thermal-electro Nanitic Brace III",  cpu: 6, pg: 20, slot: "medium" },
  "thermal-electro_nanitic_brace_iv":   { name: "Thermal-electro Nanitic Brace IV",   cpu: 8, pg: 35, slot: "medium" },
  "explonetic-electro_nanitic_brace_ii":  { name: "Explonetic-electro Nanitic Brace II",  cpu: 4, pg: 8,  slot: "medium" },
  "explonetic-electro_nanitic_brace_iii": { name: "Explonetic-electro Nanitic Brace III", cpu: 6, pg: 20, slot: "medium" },
  "explonetic-electro_nanitic_brace_iv":  { name: "Explonetic-electro Nanitic Brace IV",  cpu: 8, pg: 35, slot: "medium" },
  "explo-electro_nanitic_brace_ii":  { name: "Explo-electro Nanitic Brace II",  cpu: 4, pg: 8,  slot: "medium" },
  "explo-electro_nanitic_brace_iii": { name: "Explo-electro Nanitic Brace III", cpu: 6, pg: 20, slot: "medium" },
  "explo-electro_nanitic_brace_iv":  { name: "Explo-electro Nanitic Brace IV",  cpu: 8, pg: 35, slot: "medium" },

  // ── ADAPTIVE ARMOR HARDENER ─────────────────────────────────────────────────
  "adaptive_nanitic_armor_weave_ii":  { name: "Adaptive Nanitic Armor Weave II",  cpu: 4,  pg: 8,   slot: "medium" },
  "adaptive_nanitic_armor_weave_iii": { name: "Adaptive Nanitic Armor Weave III", cpu: 16, pg: 46,  slot: "medium" },
  "adaptive_nanitic_armor_weave_iv":  { name: "Adaptive Nanitic Armor Weave IV",  cpu: 25, pg: 300, slot: "medium" },

  // ── ARMOR PLATES ────────────────────────────────────────────────────────────
  "bulky_armor_plates_ii":  { name: "Bulky Armor Plates II",  cpu: 4,  pg: 10,   slot: "low" },
  "bulky_armor_plates_iii": { name: "Bulky Armor Plates III", cpu: 7,  pg: 290,  slot: "low" },
  "bulky_armor_plates_v":   { name: "Bulky Armor Plates V",   cpu: 12, pg: 2530, slot: "low" }, // no IV screenshot found
  "coated_armor_plates_ii":  { name: "Coated Armor Plates II",  cpu: 4,  pg: 10,  slot: "low" },
  "coated_armor_plates_iii": { name: "Coated Armor Plates III", cpu: 7,  pg: 290, slot: "low" },
  "coated_armor_plates_iv":  { name: "Coated Armor Plates IV",  cpu: 10, pg: 295, slot: "low" },
  "nimble_armor_plates_ii":  { name: "Nimble Armor Plates II",  cpu: 4,  pg: 10,  slot: "low" },
  "nimble_armor_plates_iii": { name: "Nimble Armor Plates III", cpu: 7,  pg: 290, slot: "low" },
  "nimble_armor_plates_iv":  { name: "Nimble Armor Plates IV",  cpu: 10, pg: 295, slot: "low" },
  "reactive_armor_plates_ii":  { name: "Reactive Armor Plates II",  cpu: 4,  pg: 10,  slot: "low" },
  "reactive_armor_plates_iii": { name: "Reactive Armor Plates III", cpu: 7,  pg: 290, slot: "low" },
  "reactive_armor_plates_iv":  { name: "Reactive Armor Plates IV",  cpu: 10, pg: 295, slot: "low" },

  // ── ENERGY LANCE WEAPONS ────────────────────────────────────────────────────
  // Small (S) — turret hardpoint required
  "tuho_7": { name: "Tuho 7", cpu: 6,  pg: 8,   slot: "high" },
  "tuho_9": { name: "Tuho 9", cpu: 7,  pg: 9,   slot: "high" },
  "tuho_s": { name: "Tuho S", cpu: 8,  pg: 10,  slot: "high" },
  // Medium (M) — turret hardpoint required
  "xoru_7": { name: "Xoru 7", cpu: 15, pg: 230, slot: "high" },
  "xoru_9": { name: "Xoru 9", cpu: 16, pg: 245, slot: "high" },
  "xoru_s": { name: "Xoru S", cpu: 17, pg: 260, slot: "high" },

  // ── MASS DRIVER (COILGUN) WEAPONS ───────────────────────────────────────────
  "base_coilgun_s":   { name: "Base Coilgun (S)",   cpu: 6,  pg: 8,   slot: "high" },
  "base_coilgun_m":   { name: "Base Coilgun (M)",   cpu: 15, pg: 230, slot: "high" },
  "tier_2_coilgun_s": { name: "Tier 2 Coilgun (S)", cpu: 7,  pg: 9,   slot: "high" },
  "tier_2_coilgun_m": { name: "Tier 2 Coilgun (M)", cpu: 16, pg: 245, slot: "high" },
  "tier_3_coilgun_s": { name: "Tier 3 Coilgun (S)", cpu: 8,  pg: 10,  slot: "high" },
  "tier_3_coilgun_m": { name: "Tier 3 Coilgun (M)", cpu: 17, pg: 260, slot: "high" },

  // ── MINING MODULES ──────────────────────────────────────────────────────────
  "crude_extractor":            { name: "Crude Extractor",            cpu: 20, pg: 20, slot: "high" },
  "small_cutting_laser":        { name: "Small Cutting Laser",        cpu: 2,  pg: 8,  slot: "high" },
  "medium_cutting_laser":       { name: "Medium Cutting Laser",       cpu: 10, pg: 14, slot: "high" },
  "purified_moon_cutting_laser": { name: "Purified Moon Cutting Laser", cpu: 10, pg: 24, slot: "high" },

  // ── PLASMA WEAPONS ──────────────────────────────────────────────────────────
  "base_rapid_plasma_s":   { name: "Base Rapid Plasma (S)",   cpu: 6,  pg: 8,   slot: "high" },
  "rapid_plasma_m":        { name: "Rapid Plasma (M)",        cpu: 15, pg: 230, slot: "high" },
  "tier_2_rapid_plasma_s": { name: "Tier 2 Rapid Plasma (S)", cpu: 7,  pg: 9,   slot: "high" },
  "tier_2_rapid_plasma_m": { name: "Tier 2 Rapid Plasma (M)", cpu: 16, pg: 245, slot: "high" },
  "tier_3_rapid_plasma_s": { name: "Tier 3 Rapid Plasma (S)", cpu: 8,  pg: 10,  slot: "high" },
  "tier_3_rapid_plasma_m": { name: "Tier 3 Rapid Plasma (M)", cpu: 16, pg: 255, slot: "high" },

  // ── AUTOCANNONS ─────────────────────────────────────────────────────────────
  "base_autocannon_s":   { name: "Base Autocannon (S)",   cpu: 6, pg: 4, slot: "high" },
  "tier_2_autocannon_s": { name: "Tier 2 Autocannon (S)", cpu: 7, pg: 5, slot: "high" },
  "tier_3_autocannon_s": { name: "Tier 3 Autocannon (S)", cpu: 8, pg: 6, slot: "high" },

  // ── HOWITZERS ───────────────────────────────────────────────────────────────
  "base_howitzer_m":   { name: "Base Howitzer (M)",   cpu: 15, pg: 230, slot: "high" },
  "tier_2_howitzer_m": { name: "Tier 2 Howitzer (M)", cpu: 16, pg: 245, slot: "high" },
  "tier_3_howitzer_m": { name: "Tier 3 Howitzer (M)", cpu: 17, pg: 260, slot: "high" },

  // ── HULL REPAIRER ───────────────────────────────────────────────────────────
  "hull_repairer": { name: "Hull Repairer", cpu: 2, pg: 3, slot: "low" },

  // ── PROPULSION — AFTERBURNERS ───────────────────────────────────────────────
  "afterburner_ii":  { name: "Afterburner II",  cpu: 3,  pg: 6,   slot: "medium" },
  "afterburner_iii": { name: "Afterburner III", cpu: 12, pg: 210, slot: "medium" },
  "afterburner_iv":  { name: "Afterburner IV",  cpu: 18, pg: 295, slot: "medium" },

  // ── PROPULSION — MICROWARPDRIVES (named) ────────────────────────────────────
  "hop":  { name: "Hop",  cpu: 7,  pg: 13, slot: "medium" },
  "leap": { name: "Leap", cpu: 11, pg: 22, slot: "medium" },
  "lunge": { name: "Lunge", cpu: 11, pg: 22, slot: "medium" },
  "skip": { name: "Skip", cpu: 5,  pg: 8,  slot: "medium" },

  // ── SHIELD HARDENERS — Field Arrays ─────────────────────────────────────────
  "thermal_field_array_ii":   { name: "Thermal Field Array II",   cpu: 4, pg: 1, slot: "medium" },
  "thermal_field_array_iii":  { name: "Thermal Field Array III",  cpu: 4, pg: 1, slot: "medium" },
  "thermal_field_array_iv":   { name: "Thermal Field Array IV",   cpu: 4, pg: 1, slot: "medium" },
  "em_field_array_ii":        { name: "EM Field Array II",        cpu: 4, pg: 1, slot: "medium" },
  "em_field_array_iii":       { name: "EM Field Array III",       cpu: 4, pg: 1, slot: "medium" },
  "em_field_array_iv":        { name: "EM Field Array IV",        cpu: 4, pg: 1, slot: "medium" },
  "explosive_field_array_ii":  { name: "Explosive Field Array II",  cpu: 4, pg: 1, slot: "medium" },
  "explosive_field_array_iii": { name: "Explosive Field Array III", cpu: 4, pg: 1, slot: "medium" },
  "explosive_field_array_iv":  { name: "Explosive Field Array IV",  cpu: 4, pg: 1, slot: "medium" },
  "kinetic_field_array_ii":   { name: "Kinetic Field Array II",   cpu: 4, pg: 1, slot: "medium" },
  "kinetic_field_array_iii":  { name: "Kinetic Field Array III",  cpu: 4, pg: 1, slot: "medium" },
  "kinetic_field_array_iv":   { name: "Kinetic Field Array IV",   cpu: 4, pg: 1, slot: "medium" },

  // ── SHIELD REPAIRERS ────────────────────────────────────────────────────────
  "shield_restorer_ii":  { name: "Shield Restorer II",  cpu: 4, pg: 4,   slot: "medium" },
  "shield_restorer_iii": { name: "Shield Restorer III", cpu: 4, pg: 290, slot: "medium" },
  "shield_restorer_iv":  { name: "Shield Restorer IV",  cpu: 4, pg: 295, slot: "medium" },

  // ── SHIELD EXTENDERS ────────────────────────────────────────────────────────
  "attuned_shield_generator_ii":    { name: "Attuned Shield Generator II",    cpu: 4,  pg: 10,  slot: "medium" },
  "attuned_shield_generator_iii":   { name: "Attuned Shield Generator III",   cpu: 7,  pg: 290, slot: "medium" },
  "attuned_shield_generator_iv":    { name: "Attuned Shield Generator IV",    cpu: 10, pg: 295, slot: "medium" },
  "bulwark_shield_generator_ii":    { name: "Bulwark Shield Generator II",    cpu: 4,  pg: 10,  slot: "medium" },
  "bulwark_shield_generator_iii":   { name: "Bulwark Shield Generator III",   cpu: 7,  pg: 290, slot: "medium" },
  "bulwark_shield_generator_iv":    { name: "Bulwark Shield Generator IV",    cpu: 10, pg: 295, slot: "medium" },
  "reinforced_shield_generator_ii":  { name: "Reinforced Shield Generator II",  cpu: 4,  pg: 10,  slot: "medium" },
  "reinforced_shield_generator_iii": { name: "Reinforced Shield Generator III", cpu: 7,  pg: 290, slot: "medium" },
  "reinforced_shield_generator_iv":  { name: "Reinforced Shield Generator IV",  cpu: 10, pg: 295, slot: "medium" },

  // ── CARGO EXPANDERS ─────────────────────────────────────────────────────────
  // Note: Cargo Grid modules display no CPU cost in-game (cpu: 0 is accurate)
  "cargo_grid_ii":  { name: "Cargo Grid II",  cpu: 0, pg: 10,   slot: "low" },
  "cargo_grid_iii": { name: "Cargo Grid III", cpu: 0, pg: 290,  slot: "low" },
  "cargo_grid_iv":  { name: "Cargo Grid IV",  cpu: 0, pg: 295,  slot: "low" },
  "cargo_grid_v":   { name: "Cargo Grid V",   cpu: 0, pg: 1265, slot: "low" },
  "cargo_grid_vi":  { name: "Cargo Grid VI",  cpu: 0, pg: 2540, slot: "low" },

  // ── WARP DISRUPTORS — Stasis Net ────────────────────────────────────────────
  "stasis_net_ii":  { name: "Stasis Net II",  cpu: 7, pg: 4, slot: "medium" },
  "stasis_net_iii": { name: "Stasis Net III", cpu: 7, pg: 4, slot: "medium" },
  "stasis_net_iv":  { name: "Stasis Net IV",  cpu: 7, pg: 4, slot: "medium" },
  "stasis_net_v":   { name: "Stasis Net V",   cpu: 7, pg: 4, slot: "medium" },
  "stasis_net_vi":  { name: "Stasis Net VI",  cpu: 7, pg: 4, slot: "medium" },

  // ── WARP SCRAMBLERS — Warp Entangler ────────────────────────────────────────
  "warp_entangler_ii":  { name: "Warp Entangler II",  cpu: 6,  pg: 2, slot: "medium" },
  "warp_entangler_iii": { name: "Warp Entangler III", cpu: 10, pg: 2, slot: "medium" },
  "warp_entangler_iv":  { name: "Warp Entangler IV",  cpu: 16, pg: 2, slot: "medium" },
  "warp_entangler_v":   { name: "Warp Entangler V",   cpu: 20, pg: 2, slot: "medium" },
  "warp_entangler_vi":  { name: "Warp Entangler VI",  cpu: 28, pg: 2, slot: "medium" },
};
