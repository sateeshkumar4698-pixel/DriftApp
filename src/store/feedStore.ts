import { create } from 'zustand';
import { Post } from '../types';

interface FeedState {
  posts: Post[];
  liveUserCount: number;
  liveCity: string;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;

  setPosts:         (posts: Post[]) => void;
  appendPosts:      (posts: Post[]) => void;
  updatePost:       (postId: string, update: Partial<Post>) => void;
  setLiveUserCount: (count: number, city: string) => void;
  setHasMore:       (v: boolean) => void;
  setLoading:       (v: boolean) => void;
  setRefreshing:    (v: boolean) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts:         [],
  liveUserCount: 0,
  liveCity:      '',
  hasMore:       true,
  loading:       true,
  refreshing:    false,

  setPosts:    (posts)   => set({ posts }),
  appendPosts: (posts)   => set((s) => ({ posts: [...s.posts, ...posts] })),
  updatePost:  (id, upd) => set((s) => ({
    posts: s.posts.map((p) => (p.id === id ? { ...p, ...upd } : p)),
  })),
  setLiveUserCount: (count, city) => set({ liveUserCount: count, liveCity: city }),
  setHasMore:    (v) => set({ hasMore: v }),
  setLoading:    (v) => set({ loading: v }),
  setRefreshing: (v) => set({ refreshing: v }),
}));
