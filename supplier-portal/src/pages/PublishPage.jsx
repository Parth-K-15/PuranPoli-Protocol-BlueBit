import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { workspaceApi } from "../services/api";

export default function PublishPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [publisherName, setPublisherName] = useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    workspaceApi
      .get(workspaceId)
      .then((data) => {
        const ws = data.workspace ?? data;
        setWorkspace(ws);
        setPublisherName(ws.publisherName || user?.companyName || "");
        setTags(ws.tags?.join(", ") || "");
        setDescription(ws.description || "");
      })
      .catch(() => setError("Failed to load workspace"))
      .finally(() => setLoading(false));
  }, [workspaceId, user]);

  const handlePublish = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const data = await workspaceApi.publish(workspaceId, {
        publisherName,
        tags: tagArray,
        description,
      });
      const ws = data.workspace ?? data;
      setWorkspace(ws);
      setSuccess("Workspace published successfully!");
    } catch (err) {
      setError(err.response?.data?.message || "Publish failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const data = await workspaceApi.unpublish(workspaceId);
      const ws = data.workspace ?? data;
      setWorkspace(ws);
      setSuccess("Workspace unpublished.");
    } catch (err) {
      setError(err.response?.data?.message || "Unpublish failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="material-symbols-outlined animate-spin text-[#6d6fd8]">
            progress_activity
          </span>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined mb-3 text-5xl text-slate-300">
          error
        </span>
        <p className="text-slate-500">Workspace not found.</p>
        <Link
          to="/"
          className="mt-4 text-sm font-medium text-[#6d6fd8] hover:text-[#5b5dc0]"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isPublished = workspace.isPublished;

  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      {/* Back link */}
      <Link
        to={`/graph/${workspaceId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-[#6d6fd8]"
      >
        <span className="material-symbols-outlined text-[18px]">
          arrow_back
        </span>
        Back to Graph Builder
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Publish Workspace</h1>
        <p className="mt-1 text-sm text-slate-500">{workspace.name}</p>
      </div>

      {/* Status badge */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Status:</span>
        {isPublished ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Published
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Not Published
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="material-symbols-outlined text-[20px] text-[#b1b2ff]">
            circle
          </span>
          <span className="font-medium">{workspace.nodeCount ?? workspace.nodes ?? 0}</span> nodes
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="material-symbols-outlined text-[20px] text-[#b1b2ff]">
            trending_flat
          </span>
          <span className="font-medium">{workspace.edgeCount ?? workspace.edges ?? 0}</span> edges
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="material-symbols-outlined text-[20px] text-[#b1b2ff]">
            download
          </span>
          <span className="font-medium">{workspace.importCount ?? workspace.imports ?? 0}</span> imports
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
          {success}
        </div>
      )}

      {/* Published view */}
      {isPublished ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Published Information
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-slate-600">Publisher:</span>{" "}
              <span className="text-slate-800">
                {workspace.publisherName || "N/A"}
              </span>
            </div>
            {workspace.tags?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-600">Tags:</span>
                {workspace.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#b1b2ff]/10 px-2.5 py-0.5 text-xs font-medium text-[#6d6fd8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {workspace.description && (
              <div>
                <span className="font-medium text-slate-600">Description:</span>{" "}
                <span className="text-slate-800">{workspace.description}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleUnpublish}
            disabled={submitting}
            className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              unpublished
            </span>
            {submitting ? "Unpublishing..." : "Unpublish"}
          </button>
        </div>
      ) : (
        /* Publish form */
        <form
          onSubmit={handlePublish}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h2 className="mb-5 text-lg font-semibold text-slate-800">
            Publish Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Publisher Name
              </label>
              <input
                type="text"
                required
                value={publisherName}
                onChange={(e) => setPublisherName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#6d6fd8] focus:ring-2 focus:ring-[#b1b2ff]/30"
                placeholder="Your company name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#6d6fd8] focus:ring-2 focus:ring-[#b1b2ff]/30"
                placeholder="electronics, semiconductors, asia"
              />
              <p className="mt-1 text-xs text-slate-400">
                Comma-separated list of tags
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#6d6fd8] focus:ring-2 focus:ring-[#b1b2ff]/30"
                placeholder="Brief description of your supply chain..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex items-center gap-2 rounded-xl bg-[#6d6fd8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5b5dc0] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              publish
            </span>
            {submitting ? "Publishing..." : "Publish Workspace"}
          </button>
        </form>
      )}
    </div>
  );
}
