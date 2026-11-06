import { productCaption } from "../products";

const base = {
  title: "Kanchipuram Silk Saree",
  price_min: 4500,
  price_max: 4500,
  currency: "INR",
  online_url: "https://shop.example/products/silk",
  tracks_inventory: true,
  total_inventory: 3,
};

describe("productCaption", () => {
  it("formats title, price, stock and link like the web composer", () => {
    expect(productCaption(base)).toBe("*Kanchipuram Silk Saree*\n₹4,500\nIn stock\nhttps://shop.example/products/silk");
  });
  it("shows a price range and out of stock, and omits a missing link", () => {
    expect(productCaption({ ...base, price_max: 6000.5, total_inventory: 0, online_url: null })).toBe(
      "*Kanchipuram Silk Saree*\n₹4,500 – ₹6,000.50\nOut of stock",
    );
  });
  it("treats untracked inventory as in stock", () => {
    expect(productCaption({ ...base, tracks_inventory: false, total_inventory: null })).toContain("In stock");
  });
});
