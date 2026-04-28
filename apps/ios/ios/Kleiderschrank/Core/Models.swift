import Foundation

struct SessionPayload: Codable {
    var authenticated: Bool
    var user: UserSummary?
    var wardrobe: [WardrobeItem]
    var savedOutfits: [SavedOutfit]
    var sharedOutfits: [SharedPost]
    var featuredProfiles: [FeaturedProfile]
    var sessionToken: String?
}

struct UserSummary: Codable, Identifiable, Hashable {
    var id: Int
    var displayName: String
    var username: String
    var bio: String
    var avatarUrl: String
    var createdAt: String
    var stats: ProfileStats?
}

struct FeaturedProfile: Codable, Identifiable, Hashable {
    var id: Int
    var displayName: String
    var username: String
    var bio: String
    var avatarUrl: String
    var createdAt: String
    var stats: ProfileStats
    var isFollowing: Bool
}

struct ProfileStats: Codable, Hashable {
    var followers: Int
    var following: Int
    var wardrobeItems: Int
    var sharedOutfits: Int
}

struct WardrobeItem: Codable, Identifiable, Hashable {
    var id: String
    var numericId: Int
    var userId: Int
    var name: String
    var category: String
    var color: String
    var seasons: [String]
    var temperature: String
    var occasions: [String]
    var styles: [String]
    var image: String
    var createdAt: String
}

struct WeatherSnapshot: Codable, Hashable {
    var temperature: Double?
    var weatherLabel: String?
}

struct SavedOutfit: Codable, Identifiable, Hashable {
    var id: String
    var numericId: Int
    var name: String
    var caption: String
    var occasion: String
    var itemIds: [String]
    var items: [WardrobeItem]
    var weatherSnapshot: WeatherSnapshot
    var createdAt: String
}

struct PostAuthor: Codable, Identifiable, Hashable {
    var id: Int
    var displayName: String
    var username: String
    var bio: String
    var avatarUrl: String
}

struct PostComment: Codable, Identifiable, Hashable {
    var id: String
    var authorName: String
    var authorUsername: String
    var text: String
    var createdAt: String
}

struct SharedPost: Codable, Identifiable, Hashable {
    var id: String
    var numericId: Int
    var outfitId: String
    var author: PostAuthor
    var isFollowing: Bool
    var likedByViewer: Bool
    var outfitName: String
    var caption: String
    var occasion: String
    var createdAt: String
    var weatherSnapshot: WeatherSnapshot?
    var likes: Int
    var comments: [PostComment]
    var previewItems: [WardrobeItem]
}

struct PublicProfilePayload: Codable {
    var profile: PublicProfile
    var sharedOutfits: [SharedPost]
}

struct PublicProfile: Codable, Identifiable, Hashable {
    var id: Int
    var displayName: String
    var username: String
    var bio: String
    var avatarUrl: String
    var createdAt: String
    var stats: ProfileStats
    var isFollowing: Bool
    var isCurrentUser: Bool
}

struct ProfileUpdateResponse: Codable {
    var user: UserSummary
}

struct WeatherResponse: Codable, Hashable {
    var current: CurrentWeather
}

struct CurrentWeather: Codable, Hashable {
    var temperature_2m: Double
    var apparent_temperature: Double
    var weather_code: Int
    var is_day: Int?
    var wind_speed_10m: Double
}

struct EmptyResponse: Codable {
    var ok: Bool
}

struct HealthResponse: Codable {
    var ok: Bool
    var uptimeSeconds: Int?
}

struct APIErrorResponse: Codable {
    var error: String
}
