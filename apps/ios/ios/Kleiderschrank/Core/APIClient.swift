import Foundation

enum APIClientError: LocalizedError {
    case invalidBaseURL
    case unconfiguredBaseURL
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Die API-URL in der App ist ungueltig."
        case .unconfiguredBaseURL:
            return "Die App ist noch nicht mit deinem Backend verbunden. Trage in Info.plist bei APIBaseURL fuer den Simulator http://127.0.0.1:3000 oder spaeter deine echte HTTPS-Server-URL ein."
        case .invalidResponse:
            return "Die Serverantwort konnte nicht gelesen werden."
        case let .server(message):
            return message
        }
    }
}

struct APIClient {
    static let placeholderBaseURL = "https://deine-app-api.onrender.com"
    static let overrideKey = "kleiderschrank.api.baseURL.override"

    let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()

    let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        return encoder
    }()

    var baseURL: URL {
        URL(string: Self.currentBaseURLString)!
    }

    static var currentBaseURLString: String {
        storedBaseURLOverride() ?? defaultBaseURLString()
    }

    static var isUsingPlaceholderBaseURL: Bool {
        currentBaseURLString == placeholderBaseURL
    }

    static func storedBaseURLOverride() -> String? {
        let raw = UserDefaults.standard.string(forKey: overrideKey)
        return normalizeBaseURLString(raw)
    }

    static func defaultBaseURLString(bundle: Bundle = .main) -> String {
        if let base = bundle.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let normalized = normalizeBaseURLString(base) {
            return normalized
        }

        return placeholderBaseURL
    }

    static func saveBaseURLOverride(_ value: String?) {
        guard let normalized = normalizeBaseURLString(value) else {
            UserDefaults.standard.removeObject(forKey: overrideKey)
            return
        }

        UserDefaults.standard.set(normalized, forKey: overrideKey)
    }

    static func normalizeBaseURLString(_ value: String?) -> String? {
        guard let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty,
              let url = URL(string: raw), let scheme = url.scheme?.lowercased(),
              ["http", "https"].contains(scheme), url.host != nil else {
            return nil
        }

        let absolute = url.absoluteString
        return absolute.replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
    }

    func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: Encodable? = nil,
        token: String? = nil
    ) async throws -> T {
        if baseURL.absoluteString == Self.placeholderBaseURL {
            throw APIClientError.unconfiguredBaseURL
        }

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIClientError.invalidBaseURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30

        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try AnyEncodable(body).encoded(with: encoder)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        if (200 ... 299).contains(httpResponse.statusCode) {
            return try decoder.decode(T.self, from: data)
        }

        if let apiError = try? decoder.decode(APIErrorResponse.self, from: data) {
            throw APIClientError.server(apiError.error)
        }

        throw APIClientError.invalidResponse
    }
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encodeClosure = { encoder in
            try wrapped.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }

    func encoded(with encoder: JSONEncoder) throws -> Data {
        try encoder.encode(self)
    }
}
