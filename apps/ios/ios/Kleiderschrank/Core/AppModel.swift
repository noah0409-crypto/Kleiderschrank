import Foundation
import SwiftUI
import UIKit

@MainActor
final class AppModel: ObservableObject {
    @Published var isBootstrapping = true
    @Published var serverBaseURL = APIClient.currentBaseURLString
    @Published var session = SessionPayload(
        authenticated: false,
        user: nil,
        wardrobe: [],
        savedOutfits: [],
        sharedOutfits: [],
        featuredProfiles: [],
        sessionToken: nil
    )
    @Published var viewedProfile: PublicProfilePayload?
    @Published var weather: WeatherResponse?
    @Published var busyKey: String?

    private let tokenKey = "kleiderschrank.native.session.token"
    private let apiClient = APIClient()
    private let locationService = LocationService()

    var sessionToken: String {
        UserDefaults.standard.string(forKey: tokenKey) ?? ""
    }

    var isUsingPlaceholderServer: Bool {
        APIClient.isUsingPlaceholderBaseURL
    }

    func bootstrap() async {
        guard isBootstrapping else { return }
        defer { isBootstrapping = false }
        refreshServerBaseURL()

        let token = sessionToken
        guard !token.isEmpty else { return }

        do {
            try await loadSession()
        } catch {
            UserDefaults.standard.removeObject(forKey: tokenKey)
            session = SessionPayload(
                authenticated: false,
                user: nil,
                wardrobe: [],
                savedOutfits: [],
                sharedOutfits: [],
                featuredProfiles: [],
                sessionToken: nil
            )
        }
    }

    func signUp(displayName: String, username: String, password: String) async throws {
        busyKey = "auth"
        defer { busyKey = nil }

        struct Payload: Encodable {
            let displayName: String
            let username: String
            let password: String
        }

        let response: SessionPayload = try await apiClient.request(
            path: "/api/signup",
            method: "POST",
            body: Payload(displayName: displayName, username: username, password: password)
        )

        apply(sessionPayload: response)
    }

    func login(username: String, password: String) async throws {
        busyKey = "auth"
        defer { busyKey = nil }

        struct Payload: Encodable {
            let username: String
            let password: String
        }

        let response: SessionPayload = try await apiClient.request(
            path: "/api/login",
            method: "POST",
            body: Payload(username: username, password: password)
        )

        apply(sessionPayload: response)
    }

    func logout() async {
        busyKey = "logout"
        defer { busyKey = nil }

        do {
            let _: EmptyResponse = try await apiClient.request(
                path: "/api/logout",
                method: "POST",
                token: sessionToken
            )
        } catch {
            // Ignore network logout errors on local reset.
        }

        clearLocalSession()
    }

    func loadSession() async throws {
        refreshServerBaseURL()
        let token = sessionToken
        guard !token.isEmpty else {
            clearLocalSession()
            return
        }

        let payload: SessionPayload = try await apiClient.request(
            path: "/api/session",
            token: token
        )

        if payload.authenticated {
            apply(sessionPayload: payload)
        } else {
            clearLocalSession()
        }
    }

    func loadWeather() async throws {
        busyKey = "weather"
        defer { busyKey = nil }

        let coordinate = try await locationService.requestLocation()
        let payload: WeatherResponse = try await apiClient.request(
            path: "/api/weather?lat=\(coordinate.latitude)&lon=\(coordinate.longitude)",
            token: sessionToken
        )

        weather = payload
    }

    func uploadWardrobe(
        name: String,
        category: String,
        color: String,
        seasons: [String],
        temperature: String,
        occasions: [String],
        styles: [String],
        imageData: Data
    ) async throws {
        busyKey = "upload"
        defer { busyKey = nil }

        struct Payload: Encodable {
            let name: String
            let category: String
            let color: String
            let seasons: [String]
            let temperature: String
            let occasions: [String]
            let styles: [String]
            let image: String
        }

        let payload = Payload(
            name: name,
            category: category,
            color: color,
            seasons: seasons,
            temperature: temperature,
            occasions: occasions,
            styles: styles,
            image: Self.makeDataURL(from: imageData)
        )

        let _: WardrobeItem = try await apiClient.request(
            path: "/api/wardrobe",
            method: "POST",
            body: payload,
            token: sessionToken
        )

        try await loadSession()
    }

    func saveOutfit(name: String, caption: String, itemIds: [String], occasion: String, weatherSnapshot: WeatherSnapshot) async throws {
        busyKey = "saveOutfit"
        defer { busyKey = nil }

        struct Payload: Encodable {
            let name: String
            let caption: String
            let itemIds: [String]
            let occasion: String
            let weatherSnapshot: WeatherSnapshot
        }

        let _: SavedOutfit = try await apiClient.request(
            path: "/api/outfits",
            method: "POST",
            body: Payload(name: name, caption: caption, itemIds: itemIds, occasion: occasion, weatherSnapshot: weatherSnapshot),
            token: sessionToken
        )

        try await loadSession()
    }

    func deleteOutfit(_ outfitId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            path: "/api/outfits/\(outfitId)",
            method: "DELETE",
            token: sessionToken
        )
        try await loadSession()
    }

    func shareOutfit(_ outfitId: String) async throws {
        struct Payload: Encodable {
            let outfitId: String
        }

        let _: EmptyResponse = try await apiClient.request(
            path: "/api/shared-outfits",
            method: "POST",
            body: Payload(outfitId: outfitId),
            token: sessionToken
        )
        try await loadSession()
    }

    func deleteWardrobeItem(_ itemId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            path: "/api/wardrobe/\(itemId)",
            method: "DELETE",
            token: sessionToken
        )
        try await loadSession()
    }

    func saveProfile(displayName: String, bio: String, avatarData: Data?, clearAvatar: Bool) async throws {
        busyKey = "profile"
        defer { busyKey = nil }

        struct Payload: Encodable {
            let displayName: String
            let bio: String
            let avatarImage: String?
            let clearAvatar: Bool
        }

        let avatarImage = avatarData.map { data in
            Self.makeDataURL(from: data)
        }

        let response: ProfileUpdateResponse = try await apiClient.request(
            path: "/api/profile",
            method: "PATCH",
            body: Payload(
                displayName: displayName,
                bio: bio,
                avatarImage: avatarImage,
                clearAvatar: clearAvatar
            ),
            token: sessionToken
        )

        session.user = response.user
    }

    func loadPublicProfile(username: String) async throws {
        viewedProfile = try await apiClient.request(
            path: "/api/profiles/\(username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username)",
            token: sessionToken
        )
    }

    func toggleFollow(userId: Int, refreshUsername: String?) async throws {
        struct Payload: Encodable {
            let targetUserId: Int
        }

        let _: EmptyResponse = try await apiClient.request(
            path: "/api/follows",
            method: "POST",
            body: Payload(targetUserId: userId),
            token: sessionToken
        )

        try await loadSession()

        if let refreshUsername {
            try await loadPublicProfile(username: refreshUsername)
        }
    }

    func toggleLike(postId: String, refreshUsername: String?) async throws {
        let _: EmptyResponse = try await apiClient.request(
            path: "/api/shared-outfits/\(postId)/like",
            method: "POST",
            token: sessionToken
        )

        try await loadSession()

        if let refreshUsername {
            try await loadPublicProfile(username: refreshUsername)
        }
    }

    func addComment(postId: String, text: String, refreshUsername: String?) async throws {
        struct Payload: Encodable {
            let text: String
        }

        let _: EmptyResponse = try await apiClient.request(
            path: "/api/shared-outfits/\(postId)/comments",
            method: "POST",
            body: Payload(text: text),
            token: sessionToken
        )

        try await loadSession()

        if let refreshUsername {
            try await loadPublicProfile(username: refreshUsername)
        }
    }

    func weatherLabel(for code: Int) -> String {
        switch code {
        case 0: return "Klar"
        case 1, 2, 3: return "Leicht bewoelkt"
        case 45, 48: return "Nebelig"
        case 51, 53, 55, 61, 63, 65, 80, 81, 82: return "Regnerisch"
        case 71, 73, 75, 85, 86: return "Schnee"
        case 95, 96, 99: return "Gewitter"
        default: return "Wetterwechsel"
        }
    }

    func resolvedURL(for assetPath: String) -> URL? {
        guard !assetPath.isEmpty else { return nil }
        if let absoluteURL = URL(string: assetPath), absoluteURL.scheme != nil {
            return absoluteURL
        }
        return URL(string: assetPath, relativeTo: apiClient.baseURL)
    }

    func updateServerBaseURL(_ value: String) throws {
        guard let normalized = APIClient.normalizeBaseURLString(value) else {
            throw APIClientError.invalidBaseURL
        }

        APIClient.saveBaseURLOverride(normalized)
        refreshServerBaseURL()
        clearLocalSession()
    }

    func resetServerBaseURL() {
        APIClient.saveBaseURLOverride(nil)
        refreshServerBaseURL()
        clearLocalSession()
    }

    func pingServer() async throws -> HealthResponse {
        refreshServerBaseURL()
        return try await apiClient.request(path: "/healthz")
    }

    private func apply(sessionPayload: SessionPayload) {
        refreshServerBaseURL()
        session = sessionPayload

        if let token = sessionPayload.sessionToken, !token.isEmpty {
            UserDefaults.standard.set(token, forKey: tokenKey)
        }
    }

    private func clearLocalSession() {
        refreshServerBaseURL()
        UserDefaults.standard.removeObject(forKey: tokenKey)
        session = SessionPayload(
            authenticated: false,
            user: nil,
            wardrobe: [],
            savedOutfits: [],
            sharedOutfits: [],
            featuredProfiles: [],
            sessionToken: nil
        )
        viewedProfile = nil
        weather = nil
    }

    private static func makeDataURL(from data: Data) -> String {
        "data:image/jpeg;base64,\(data.base64EncodedString())"
    }

    private func refreshServerBaseURL() {
        serverBaseURL = APIClient.currentBaseURLString
    }
}
