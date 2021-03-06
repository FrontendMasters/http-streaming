/**
 * @file - codecs.js - Handles tasks regarding codec strings such as translating them to
 * codec strings, or translating codec strings into objects that can be examined.
 */

import {findBox} from 'mux.js/lib/mp4/probe';
import {
  translateLegacyCodec,
  parseCodecs,
  codecsFromDefault
} from '@videojs/vhs-utils/dist/codecs.js';

/**
 * Returns a set of codec strings parsed from the playlist or the default
 * codec strings if no codecs were specified in the playlist
 *
 * @param {Playlist} media the current media playlist
 * @return {Object} an object with the video and audio codecs
 */
const getCodecs = function(media) {
  // if the codecs were explicitly specified, use them instead of the
  // defaults
  const mediaAttributes = media.attributes || {};

  if (mediaAttributes.CODECS) {
    return parseCodecs(mediaAttributes.CODECS);
  }
};

export const isMaat = (master, media) => {
  const mediaAttributes = media.attributes || {};

  return master && master.mediaGroups && master.mediaGroups.AUDIO &&
    mediaAttributes.AUDIO &&
    master.mediaGroups.AUDIO[mediaAttributes.AUDIO];
};

export const isMuxed = (master, media) => {
  if (!isMaat(master, media)) {
    return true;
  }

  const mediaAttributes = media.attributes || {};
  const audioGroup = master.mediaGroups.AUDIO[mediaAttributes.AUDIO];

  for (const groupId in audioGroup) {
    // If an audio group has a URI (the case for HLS, as HLS will use external playlists),
    // or there are listed playlists (the case for DASH, as the manifest will have already
    // provided all of the details necessary to generate the audio playlist, as opposed to
    // HLS' externally requested playlists), then the content is demuxed.
    if (!audioGroup[groupId].uri && !audioGroup[groupId].playlists) {
      return true;
    }
  }

  return false;
};

/**
 * Calculates the codec strings for a working configuration of
 * SourceBuffers to play variant streams in a master playlist. If
 * there is no possible working configuration, an empty object will be
 * returned.
 *
 * @param master {Object} the m3u8 object for the master playlist
 * @param media {Object} the m3u8 object for the variant playlist
 * @return {Object} the codec strings.
 *
 * @private
 */
export const codecsForPlaylist = function(master, media) {
  const mediaAttributes = media.attributes || {};
  const codecInfo = getCodecs(media) || {};

  // HLS with multiple-audio tracks must always get an audio codec.
  // Put another way, there is no way to have a video-only multiple-audio HLS!
  if (isMaat(master, media) && !codecInfo.audio) {
    if (!isMuxed(master, media)) {
      // It is possible for codecs to be specified on the audio media group playlist but
      // not on the rendition playlist. This is mostly the case for DASH, where audio and
      // video are always separate (and separately specified).
      const defaultCodecs = codecsFromDefault(master, mediaAttributes.AUDIO);

      if (defaultCodecs) {
        codecInfo.audio = defaultCodecs.audio;
      }

    }
  }

  const codecs = {};

  if (codecInfo.video) {
    codecs.video = translateLegacyCodec(`${codecInfo.video.type}${codecInfo.video.details}`);
  }

  if (codecInfo.audio) {
    codecs.audio = translateLegacyCodec(`${codecInfo.audio.type}${codecInfo.audio.details}`);
  }

  return codecs;
};

export const isLikelyFmp4Data = (bytes) => {
  return findBox(bytes, ['moof']).length > 0;
};

/*
 * Check to see if the bytes are part of a WebM media file.
 *
 * @param {Uint8Array} bytes
 *        The starting bytes of the file, generally from the map, or media initialization
 *        section, of the file.
 * @return {Boolean}
 *         Whether the bytes likely come from a WebM media file.
 * @see https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export const isLikelyWebmData = (bytes) => {
  return (bytes[0] & 0xFF) === 0x1A &&
    (bytes[1] & 0xFF) === 0x45 &&
    (bytes[2] & 0xFF) === 0xDF &&
    (bytes[3] & 0xFF) === 0xA3;
};
