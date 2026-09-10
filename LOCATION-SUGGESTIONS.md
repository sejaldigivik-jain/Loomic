# Location suggestions in Composer

The Instagram finishing-tools Location field now supports live place suggestions as the user types.

## One-time setup

1. Create a free Geoapify account/project at https://myprojects.geoapify.com/.
2. Copy the generated API key.
3. Add it to the project `.env`:

```env
GEOAPIFY_API_KEY="YOUR_KEY_HERE"
```

Optional for an India-focused workspace:

```env
LOCATION_SEARCH_COUNTRY_CODE="in"
```

Optional Pune bias (still allows other results unless a country filter is set):

```env
LOCATION_SEARCH_BIAS="proximity:73.8567,18.5204"
```

4. Restart SocialFlow with `RUN-SOCIALFLOW.bat`.
5. Composer → Instagram finishing tools → Location → type 2+ characters.

## Behavior

- 350 ms debounce while typing.
- Up to 7 suggestions.
- API key stays server-side.
- 5-minute server cache reduces repeat requests.
- Selected location is saved with the post as the existing finishing-location field.
- The native Instagram location picker is still not exposed by the current Instagram publishing flow; this feature provides real place discovery and saves the chosen place for the finishing step.
