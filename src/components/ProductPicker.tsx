import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api, ApiError } from "@/lib/api";
import { formatPriceRange, isInStock } from "@/lib/products";
import { useTheme } from "@/lib/theme";
import type { ProductListItem } from "@/lib/types";

import { SheetModal } from "./SheetModal";

/** Search the synced Shopify catalogue (`GET /api/products?q=`) and pick one. */
export function ProductPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: ProductListItem) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q: Record<string, string> = { limit: "30" };
        if (query.trim()) q.q = query.trim();
        const data = await api<{ products?: ProductListItem[] }>("/api/products", { query: q });
        if (id === reqId.current) {
          setItems(data.products ?? []);
          setError(null);
        }
      } catch (e) {
        if (id === reqId.current) {
          setItems([]);
          setError(e instanceof ApiError ? e.message : "Couldn't load products.");
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [visible, query]);

  return (
    <SheetModal visible={visible} title="Send a product" onClose={onClose}>
      <TextInput
        style={[styles.search, { backgroundColor: theme.surface, color: theme.text }]}
        placeholder="Search products"
        placeholderTextColor={theme.muted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {error && <Text style={[styles.msg, { color: theme.danger }]}>{error}</Text>}
      {loading && items.length === 0 ? (
        <ActivityIndicator style={styles.msg} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={!error ? <Text style={[styles.msg, { color: theme.muted }]}>No products found</Text> : undefined}
          renderItem={({ item }) => {
            const inStock = isInStock(item);
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surface }]}
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityLabel={`Send ${item.title}`}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: theme.surface }]} />
                )}
                <View style={styles.flex}>
                  <Text style={{ color: theme.text, fontWeight: "600" }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 13 }}>
                    {formatPriceRange(item)} ·{" "}
                    <Text style={{ color: inStock ? theme.primary : theme.danger }}>{inStock ? "In stock" : "Out of stock"}</Text>
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { margin: 12, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  msg: { textAlign: "center", margin: 20 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: 8 },
});
