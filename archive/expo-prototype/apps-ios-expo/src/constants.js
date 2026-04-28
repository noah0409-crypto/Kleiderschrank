export const OCCASIONS = ["Alltag", "Office", "Date", "Sport", "Party"];
export const VIBES = ["clean", "bold", "cozy", "polished"];
export const CATEGORIES = ["Top", "Bottom", "Outerwear", "Shoes", "Accessory", "Dress"];
export const TEMPERATURES = ["cold", "mild", "warm", "all"];
export const SEASONS = ["Fruehling", "Sommer", "Herbst", "Winter"];
export const STYLES = ["minimal", "streetwear", "tailored", "elevated", "cozy", "bold", "sporty", "romantic"];

export const OCCASION_STYLE_MAP = {
  Alltag: ["minimal", "streetwear", "cozy"],
  Date: ["elevated", "romantic", "minimal"],
  Office: ["tailored", "minimal", "elevated"],
  Party: ["bold", "elevated", "streetwear"],
  Sport: ["sporty", "cozy"],
};

export const VIBE_STYLE_MAP = {
  bold: ["bold", "streetwear", "elevated"],
  clean: ["minimal", "tailored"],
  cozy: ["cozy", "romantic"],
  polished: ["tailored", "elevated", "minimal"],
};
