import React, { useState } from "react";
import { NavSection } from "./NavSection";
import { NavItem } from "./NavItem";
import {
  UserIcon,
  DiscIcon,
  BoxIcon,
  TransitionsIcon,
  FolderIcon,
  AudioDialsIcon,
  MusicListIcon,
  ClockIcon,
  StarIcon,
  LogoutIcon,
  ScanIcon,
  PlusIcon,
  TrashIcon,
} from "../common/Icons";
import type { NavItemId } from "../../types/player-ui";
import type { Playlist } from "../../hooks/usePlaylists";

type LeftSidebarProps = {
  activeId: NavItemId;
  onSelect: (id: NavItemId) => void;
  onScanMp3s?: () => void;
  playlists?: Playlist[];
  onCreatePlaylist?: (name: string) => void;
  onDeletePlaylist?: (id: string) => void;
  favoritesCount?: number;
  totalTracksCount?: number;
  artistsCount?: number;
  albumsCount?: number;
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeId,
  onSelect,
  onScanMp3s,
  playlists = [],
  onCreatePlaylist,
  onDeletePlaylist,
  favoritesCount = 0,
  totalTracksCount = 0,
  artistsCount = 5,
  albumsCount = 6,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() && onCreatePlaylist) {
      onCreatePlaylist(newTitle.trim());
      setNewTitle("");
      setIsCreating(false);
    }
  };

  return (
    <aside className="ahoy-sidebar" aria-label="Main Navigation">
      <div className="ahoy-sidebar-content">
        <div className="ahoy-sidebar-action-wrap">
          <button
            type="button"
            className="ahoy-scan-mp3-btn"
            onClick={onScanMp3s}
            title="Scan local storage for MP3 tracks"
          >
            <ScanIcon size={16} />
            <span>Scan for MP3s</span>
          </button>
        </div>

        {/* Library Section */}
        <NavSection title="Library">
          <NavItem
            id="artists"
            label="Artists"
            icon={<UserIcon size={16} />}
            count={artistsCount}
            active={activeId === "artists"}
            onClick={() => onSelect("artists")}
          />
          <NavItem
            id="albums-disc"
            label="Albums"
            icon={<DiscIcon size={16} />}
            count={albumsCount}
            active={activeId === "albums-disc"}
            onClick={() => onSelect("albums-disc")}
          />
          <NavItem
            id="albums-box"
            label="Crate Flow (3D)"
            icon={<BoxIcon size={16} />}
            active={activeId === "albums-box"}
            onClick={() => onSelect("albums-box")}
          />
          <NavItem
            id="transitions"
            label="Transitions"
            icon={<TransitionsIcon size={16} />}
            active={activeId === "transitions"}
            onClick={() => onSelect("transitions")}
          />
          <NavItem
            id="playlists"
            label="All Tracks"
            icon={<FolderIcon size={16} />}
            count={totalTracksCount}
            active={activeId === "playlists"}
            onClick={() => onSelect("playlists")}
          />
          <NavItem
            id="audio"
            label="Tactile Audio"
            icon={<AudioDialsIcon size={16} />}
            active={activeId === "audio"}
            onClick={() => onSelect("audio")}
          />
        </NavSection>

        {/* Playlists Section with + New Playlist */}
        <NavSection
          title="Playlists"
          action={
            <button
              type="button"
              className="ahoy-add-playlist-btn"
              onClick={() => setIsCreating((prev) => !prev)}
              title="Create new custom playlist"
              aria-label="Create new custom playlist"
            >
              <PlusIcon size={13} />
              <span>New</span>
            </button>
          }
        >
          {/* Inline Playlist Creator Form */}
          {isCreating && (
            <form className="ahoy-inline-create-playlist" onSubmit={handleCreateSubmit}>
              <input
                type="text"
                autoFocus
                placeholder="Playlist name..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="ahoy-inline-playlist-input"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewTitle("");
                  }
                }}
              />
              <div className="ahoy-inline-create-actions">
                <button
                  type="submit"
                  className="ahoy-inline-submit-btn"
                  disabled={!newTitle.trim()}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="ahoy-inline-cancel-btn"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle("");
                  }}
                >
                  ✕
                </button>
              </div>
            </form>
          )}

          {playlists.map((playlist) => (
            <NavItem
              key={playlist.id}
              id={playlist.id}
              label={playlist.name}
              icon={<MusicListIcon size={16} />}
              count={playlist.trackIds.length}
              active={activeId === playlist.id}
              onClick={() => onSelect(playlist.id)}
              rightAction={
                onDeletePlaylist ? (
                  <button
                    type="button"
                    className="ahoy-playlist-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePlaylist(playlist.id);
                    }}
                    title={`Delete playlist "${playlist.name}"`}
                    aria-label={`Delete playlist "${playlist.name}"`}
                  >
                    <TrashIcon size={12} />
                  </button>
                ) : undefined
              }
            />
          ))}
        </NavSection>

        {/* Customize / Sovereign Section */}
        <NavSection title="Customize Workspace">
          <NavItem
            id="recently-added-clock"
            label="Recently Added"
            icon={<ClockIcon size={16} />}
            active={activeId === "recently-added-clock"}
            onClick={() => onSelect("recently-added-clock")}
          />
          <NavItem
            id="recently-added-star"
            label="Starred Favorites"
            icon={<StarIcon size={16} filled={favoritesCount > 0} color="var(--ahoy-accent-gold, #f59e0b)" />}
            count={favoritesCount}
            active={activeId === "recently-added-star"}
            onClick={() => onSelect("recently-added-star")}
          />
          <NavItem
            id="logout"
            label="Sovereign Storage"
            icon={<LogoutIcon size={16} />}
            active={activeId === "logout"}
            onClick={() => onSelect("logout")}
          />
        </NavSection>
      </div>
    </aside>
  );
};
