import React from "react";
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
} from "../common/Icons";
import type { NavItemId } from "../../types/player-ui";

type LeftSidebarProps = {
  activeId: NavItemId;
  onSelect: (id: NavItemId) => void;
  onScanMp3s?: () => void;
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeId,
  onSelect,
  onScanMp3s,
}) => {
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

        <NavSection title="Library">
          <NavItem
            id="artists"
            label="Artists"
            icon={<UserIcon size={16} />}
            active={activeId === "artists"}
            onClick={() => onSelect("artists")}
          />
          <NavItem
            id="albums-disc"
            label="Albums"
            icon={<DiscIcon size={16} />}
            active={activeId === "albums-disc"}
            onClick={() => onSelect("albums-disc")}
          />
          <NavItem
            id="albums-box"
            label="Albums"
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
            label="Playlists"
            icon={<FolderIcon size={16} />}
            active={activeId === "playlists"}
            onClick={() => onSelect("playlists")}
          />
          <NavItem
            id="audio"
            label="Audio"
            icon={<AudioDialsIcon size={16} />}
            active={activeId === "audio"}
            onClick={() => onSelect("audio")}
          />
        </NavSection>

        <NavSection title="Playlists">
          <NavItem
            id="top-playlists-1"
            label="Top Rated Playlists"
            icon={<MusicListIcon size={16} />}
            active={activeId === "top-playlists-1"}
            onClick={() => onSelect("top-playlists-1")}
          />
          <NavItem
            id="top-playlists-2"
            label="Top Rated Playlists"
            icon={<MusicListIcon size={16} />}
            active={activeId === "top-playlists-2"}
            onClick={() => onSelect("top-playlists-2")}
          />
        </NavSection>

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
            label="Recently Added"
            icon={<StarIcon size={16} />}
            active={activeId === "recently-added-star"}
            onClick={() => onSelect("recently-added-star")}
          />
          <NavItem
            id="logout"
            label="Log out"
            icon={<LogoutIcon size={16} />}
            active={activeId === "logout"}
            onClick={() => onSelect("logout")}
          />
        </NavSection>
      </div>
    </aside>
  );
};
