import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { CompanyDocument, DocumentCategory } from '../types';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  FileText,
  Search,
  Lock,
  CheckCircle2,
  Clock,
  User,
  Shield,
  Download,
  BookOpen,
} from 'lucide-react';

export const DocumentsView: React.FC = () => {
  const { currentUser, showToast, hasPermission } = useWorkspace();
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const documents = workspaceService.getDocuments();

  const categories: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Documents' },
    { key: 'POLICIES', label: 'Company Policies' },
    { key: 'SOPS', label: 'Standard Operating Procedures' },
    { key: 'ENGINEERING', label: 'Engineering Specs' },
    { key: 'FINANCE', label: 'Finance & Treasury' },
  ];

  const filteredDocs = documents.filter((doc) => {
    if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAcknowledge = (docId: string) => {
    workspaceService.acknowledgeDocument(docId);
    showToast('Policy acknowledgment recorded in the company audit log.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Company Knowledge & Documents
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository for policies, SOPs, engineering standards, and institutional knowledge.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents & SOPs..."
            className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brivent-500 bg-white"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat.key
                ? 'bg-brivent-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDocs.map((doc) => {
          const isConfidential = doc.visibility === 'CONFIDENTIAL';
          const canAccessConfidential = hasPermission('ACCESS_CONFIDENTIAL_DOCS');
          const isRestricted = isConfidential && !canAccessConfidential;

          return (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between ${
                isRestricted ? 'border-rose-200 bg-rose-50/20' : ''
              }`}
            >
              <div>
                {/* Header: Category & Visibility badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {doc.category}
                  </span>
                  {isConfidential ? (
                    <Badge variant="danger" size="sm">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Confidential
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      {doc.version}
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-brivent-600 transition-colors mb-2 flex items-start gap-1.5">
                  {isRestricted && <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                  <span>{doc.title}</span>
                </h3>

                {/* Summary */}
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                  {doc.summary}
                </p>
              </div>

              {/* Footer: Owner, Reading Time */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {doc.ownerName}
                </span>

                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {doc.readingTimeMinutes} min read
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Document Reader Modal */}
      {selectedDoc && (
        <Modal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          title={selectedDoc.title}
          description={`Owner: ${selectedDoc.ownerName} • Version: ${selectedDoc.version} • Updated: ${selectedDoc.updatedAt}`}
          maxWidth="3xl"
        >
          <div className="space-y-5">
            {selectedDoc.visibility === 'CONFIDENTIAL' && !hasPermission('ACCESS_CONFIDENTIAL_DOCS') ? (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-rose-900">
                  Access Denied: Confidential Document
                </h4>
                <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                  As an intern or unauthorized user, your role does not have authorization to view confidential company financial records or executive compensation policies.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Category: {selectedDoc.category}
                  </span>
                  <span>Estimated reading duration: {selectedDoc.readingTimeMinutes} minutes</span>
                </div>

                <div className="p-6 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 leading-relaxed font-sans space-y-4 max-h-96 overflow-y-auto whitespace-pre-line">
                  {selectedDoc.contentMarkdown}
                </div>

                {selectedDoc.requiresAcknowledgment && (
                  <div className="p-4 bg-brivent-50 border border-brivent-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-brivent-900">
                        Formal Compliance Acknowledgment Required
                      </p>
                      <p className="text-[11px] text-brivent-700">
                        Confirm you have read, understood, and agreed to adhere to this guideline.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleAcknowledge(selectedDoc.id)}
                    >
                      Acknowledge Policy
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedDoc(null)}>
                Close Viewer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

