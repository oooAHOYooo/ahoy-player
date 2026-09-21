import { useState, useEffect } from "react";

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  icon?: string;
};

const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: "playlist-sailors-picks",
    name: "⚓ Sailor's Top Picks",
    trackIds: ["track-1", "track-2", "track-5", "track-7"],
    createdAt: new Date().toISOString(),
    icon: "anchor",
  },
  {
    id: "playlist-open-sea",
    name: "🌊 Open Sea Chill",
    trackIds: ["track-3", "track-4", "track-6", "track-8", "track-9"],
    createdAt: new Date().toISOString(),
    icon: "wave",
  },
];

const STORAGE_KEY_PLAYLISTS = "ahoy:user-playlists:v1";
const STORAGE_KEY_FAVORITES = "ahoy:user-favorites:v1";

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_PLAYLISTS;
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_FAVORITES);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // fallback
        }
      }
    }
    return ["track-1", "track-2", "track-6"];
  });

  // Persist playlists
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
    }
  }, [playlists]);

  // Persist favorites
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
    }
  }, [favorites]);

  const createPlaylist = (name: string): Playlist => {
    const trimmed = name.trim() || `New Playlist ${playlists.length + 1}`;
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name: trimmed,
      trackIds: [],
      createdAt: new Date().toISOString(),
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
    return newPlaylist;
  };

  const deletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleTrackInPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        const exists = p.trackIds.includes(trackId);
        return {
          ...p,
          trackIds: exists
            ? p.trackIds.filter((tId) => tId !== trackId)
            : [...p.trackIds, trackId],
        };
      })
    );
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const isFavorite = (trackId: string) => favorites.includes(trackId);

  return {
    playlists,
    favorites,
    createPlaylist,
    deletePlaylist,
    toggleTrackInPlaylist,
    toggleFavorite,
    isFavorite,
  };
}
