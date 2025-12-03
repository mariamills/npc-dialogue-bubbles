# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-12-03

### Fixed
- Hidden tokens no longer display chat bubbles to players, preventing accidental reveals of hidden NPCs

## [1.0.0] - 2025-07-02

### Added
- Initial release of NPC Dialogue Bubbles
- Token-based dialogue configuration system
- Automatic timing intervals for random speech
- Chat bubble integration using Foundry's native API
- Global enable/disable controls
- Multiple access methods (context menu, HUD button, macro)
- Scene load integration with automatic timer management
- GM-only configuration interface
- Debug mode for troubleshooting
- Localization support (English included)

### Features
- **Token Configuration**: Right-click tokens to configure custom phrases and timing
- **Automatic Speech**: NPCs speak randomly within configured intervals (default 10-60 seconds)
- **No Camera Pan**: Chat bubbles appear without moving the camera view
- **Scene Integration**: Automatically starts/stops when scenes load or tokens are added/removed
- **Macro Support**: Includes auto-generated macro for easy token configuration
- **Persistent Storage**: Configuration saved as token flags, survives scene changes

### Technical Details
- Compatible with Foundry VTT v11+
- Uses native ChatBubbles API
- No external dependencies
- Lightweight and performant
- Modular design for easy extension

## [Unreleased]

### Planned Features
- Bulk configuration for multiple tokens
- Import/export dialogue sets
- Conditional dialogue based on time/weather
- Sound integration