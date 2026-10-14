/*
 * Where things are in and around the bucket. Everything is in the bucket's
 * own units: the prototype's 560 by 640 box (see BucketArt), y down. The
 * view places things in it by percentage, so the whole drawing scales.
 */

export const BOX_W = 560;
export const BOX_H = 640;
export const BUCKET_BOX = `0 0 ${BOX_W} ${BOX_H}`;
