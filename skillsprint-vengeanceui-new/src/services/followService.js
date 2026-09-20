import { read, write, uid } from "./storage";

// following_type is kept generic ("organization" | "user") so the data
// shape matches a real follows table, even though this prototype only
// wires up UI for student → organization following.

export function getFollows() { return read("follows", []); }

export function isFollowing(followerId, followingId, followingType = "organization") {
  return getFollows().some(
    f => f.followerId === followerId && f.followingId === followingId && f.followingType === followingType
  );
}

export function follow(followerId, followingId, followingType = "organization") {
  if (!followerId || !followingId) throw new Error("Missing follower or target.");
  if (followerId === followingId) throw new Error("Cannot follow yourself.");
  if (isFollowing(followerId, followingId, followingType)) return getFollows();

  const entry = {
    id: uid("follow"),
    followerId,
    followingId,
    followingType,
    createdAt: new Date().toISOString()
  };
  write("follows", [...getFollows(), entry]);
  return entry;
}

export function unfollow(followerId, followingId, followingType = "organization") {
  write("follows", getFollows().filter(
    f => !(f.followerId === followerId && f.followingId === followingId && f.followingType === followingType)
  ));
}

export function getFollowerCount(followingId, followingType = "organization") {
  return getFollows().filter(f => f.followingId === followingId && f.followingType === followingType).length;
}

export function getFollowersOf(followingId, followingType = "organization") {
  return getFollows()
    .filter(f => f.followingId === followingId && f.followingType === followingType)
    .map(f => f.followerId);
}

export function getFollowingForUser(followerId, followingType = "organization") {
  return getFollows()
    .filter(f => f.followerId === followerId && f.followingType === followingType)
    .map(f => f.followingId);
}
